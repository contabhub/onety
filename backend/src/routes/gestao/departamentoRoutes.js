const express = require("express");
const router = express.Router();
const db = require("../../config/database");
const autenticarToken = require("../../middlewares/auth");
const { verificarPermissao } = require("../../middlewares/permissao");

// 🔶 Criar departamento
router.post("/", autenticarToken, verificarPermissao('departamentos.criar'), async (req, res) => {
  try {
    const { empresaId, nome, responsavelId } = req.body;

    if (!empresaId || !nome) {
      return res.status(400).json({ error: "Empresa e nome são obrigatórios." });
    }

    // Só valida o responsável se ele for informado
    if (responsavelId) {
      const [[check]] = await db.query(`
        SELECT id FROM usuarios_empresas
        WHERE id = ? AND empresa_id = ?
      `, [responsavelId, empresaId]);
      if (!check) {
        return res.status(403).json({ error: "Responsável não pertence à empresa." });
      }
    }

    await db.query(
      `INSERT INTO departamentos (empresa_id, nome, responsavel_id)
       VALUES (?, ?, ?)`,
      [empresaId, nome, responsavelId || null]
    );

    res.status(201).json({ message: "Departamento criado com sucesso." });
  } catch (err) {
    console.error("Erro ao criar departamento:", err);
    res.status(500).json({ error: "Erro interno ao criar departamento." });
  }
});

// 🔶 Buscar lista simples de departamentos por nome
router.get("/empresa/:empresaId/nomes", autenticarToken, verificarPermissao('departamentos.visualizar'), async (req, res) => {
  const { empresaId } = req.params;
  try {
    const [dados] = await db.query(
      `SELECT id, nome FROM departamentos WHERE empresa_id = ? ORDER BY nome`,
      [empresaId]
    );
    res.json(dados);
  } catch (err) {
    console.error("Erro ao buscar departamentos:", err);
    res.status(500).json({ error: "Erro interno ao buscar departamentos" });
  }
});

// 🔶 Buscar usuários da empresa (relacao_empresas)
router.get("/empresa/:empresaId", autenticarToken, verificarPermissao('departamentos.visualizar'), async (req, res) => {
  const { empresaId } = req.params;
  try {
    const [dados] = await db.query(`
      SELECT r.id AS relacaoId, u.nome
      FROM usuarios_empresas r
      JOIN usuarios u ON u.id = r.usuario_id
      WHERE r.empresa_id = ?
    `, [empresaId]);

    res.json(dados);
  } catch (err) {
    console.error("Erro ao buscar usuários da empresa:", err);
    res.status(500).json({ error: "Erro ao buscar usuários da empresa." });
  }
});

// 🔶 Buscar usuários de um departamento específico
router.get("/:departamentoId/usuarios", autenticarToken, verificarPermissao('departamentos.visualizar'), async (req, res) => {
  const { departamentoId } = req.params;
  try {
    const [dados] = await db.query(`
      SELECT 
        u.id,
        u.nome,
        u.email,
        r.id AS relacaoId,
        c.nome AS cargoNome
      FROM usuarios u
      JOIN usuarios_empresas r ON u.id = r.usuario_id
      LEFT JOIN cargos c ON r.cargo_id = c.id
      WHERE r.departamento_id = ?
        AND (LOWER(c.nome) NOT LIKE '%superadmin%' OR c.nome IS NULL)
        AND (u.nivel IS NULL OR LOWER(u.nivel) NOT LIKE '%superadmin%')
      ORDER BY u.nome
    `, [departamentoId]);

    res.json(dados);
  } catch (err) {
    console.error("Erro ao buscar usuários do departamento:", err);
    res.status(500).json({ error: "Erro ao buscar usuários do departamento." });
  }
});

// 🔶 Listar departamentos por empresa
router.get("/:empresaId", autenticarToken, verificarPermissao('departamentos.visualizar'), async (req, res) => {
  try {
    const { empresaId } = req.params;

    const [dados] = await db.query(`
      SELECT d.id, d.nome, d.criado_em AS dataCriacao,
       d.responsavel_id,
       re.usuario_id AS responsavelUsuarioId,
       u.nome AS responsavelNome
FROM departamentos d
LEFT JOIN usuarios_empresas re ON d.responsavel_id = re.id
LEFT JOIN usuarios u ON u.id = re.usuario_id
WHERE d.empresa_id = ?
ORDER BY d.nome
    `, [empresaId]);

    res.json(dados);
  } catch (err) {
    console.error("Erro ao listar departamentos:", err);
    res.status(500).json({ error: "Erro interno ao buscar departamentos." });
  }
});

// 🔶 Buscar o departamentoGlobalId
router.get("/:id/global", autenticarToken, verificarPermissao('departamentos.visualizar'), async (req, res) => {
  const { id } = req.params;
  try {
    const [[dep]] = await db.query(
      "SELECT departamento_global_id FROM departamentos WHERE id = ?",
      [id]
    );
    if (!dep) return res.status(404).json({ error: "Departamento não encontrado" });
    res.json(dep);
  } catch (err) {
    console.error("Erro ao buscar departamentoGlobalId:", err);
    res.status(500).json({ error: "Erro interno" });
  }
});

// 🔶 Atualizar departamento
router.put("/:id", autenticarToken, verificarPermissao('departamentos.editar'), async (req, res) => {
  const { id } = req.params;
  const { nome, responsavelId } = req.body;

  try {
    // Verifica se o departamento existe
    const [[departamento]] = await db.query(
      `SELECT * FROM departamentos WHERE id = ?`,
      [id]
    );

    if (!departamento) {
      return res.status(404).json({ error: "Departamento não encontrado." });
    }

    // Atualiza os dados
    await db.query(
      `UPDATE departamentos SET nome = ?, responsavel_id = ? WHERE id = ?`,
      [nome, responsavelId, id]
    );

    res.json({ message: "Departamento atualizado com sucesso." });
  } catch (err) {
    console.error("Erro ao atualizar departamento:", err);
    res.status(500).json({ error: "Erro interno ao atualizar departamento." });
  }
});

// Atualizar departamento de um funcionário
router.patch("/relacao-empresas/:id", autenticarToken, verificarPermissao('departamentos.editar'), async (req, res) => {
  const { id } = req.params;
  const { departamentoId } = req.body;

  try {
    // Verifica se existe a relação
    const [[relacao]] = await db.query(
      `SELECT * FROM usuarios_empresas WHERE id = ?`,
      [id]
    );

    if (!relacao) {
      return res.status(404).json({ error: "Funcionário não encontrado na relação." });
    }

    // Atualiza o departamento
    await db.query(
      `UPDATE usuarios_empresas SET departamento_id = ? WHERE id = ?`,
      [departamentoId || null, id]
    );

    res.json({ message: "Departamento atualizado com sucesso." });
  } catch (err) {
    console.error("Erro ao atualizar departamento:", err);
    res.status(500).json({ error: "Erro interno ao atualizar departamento." });
  }
});

// rota para buscar todas as relações por usuário
router.get("/relacao-empresas/usuario/:usuarioId", autenticarToken, verificarPermissao('departamentos.visualizar'), async (req, res) => {
  const { usuarioId } = req.params;
  try {
    const [dados] = await db.query(
      `SELECT * FROM usuarios_empresas WHERE usuario_id = ?`,
      [usuarioId]
    );
    res.json(dados);
  } catch (err) {
    console.error("Erro ao buscar relação:", err);
    res.status(500).json({ error: "Erro ao buscar relações do usuário." });
  }
});

// 🔴 Remover funcionário da empresa (remover da relacao_empresas)
router.delete("/relacao-empresas/:id", autenticarToken, verificarPermissao('departamentos.excluir'), async (req, res) => {
  const { id } = req.params;
  try {
    // Verifica se a relação existe
    const [[relacao]] = await db.query(
      `SELECT * FROM usuarios_empresas WHERE id = ?`,
      [id]
    );

    if (!relacao) {
      return res.status(404).json({ error: "Relação não encontrada." });
    }

    // Deleta a relação
    await db.query(
      `DELETE FROM usuarios_empresas WHERE id = ?`,
      [id]
    );

    res.json({ message: "Funcionário removido da empresa com sucesso." });
  } catch (err) {
    console.error("Erro ao remover funcionário:", err);
    res.status(500).json({ error: "Erro interno ao remover funcionário da empresa." });
  }
});


module.exports = router;
