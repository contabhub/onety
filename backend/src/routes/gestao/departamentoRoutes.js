const express = require("express");
const router = express.Router();
const db = require("../../config/database");
const { autenticarToken } = require("../../middlewares/auth");
const { verificarPermissao } = require("../../middlewares/permissaoMiddleware");

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
        SELECT id FROM relacao_empresas
        WHERE id = ? AND empresaId = ?
      `, [responsavelId, empresaId]);
      if (!check) {
        return res.status(403).json({ error: "Responsável não pertence à empresa." });
      }
    }

    await db.query(
      `INSERT INTO departamentos (empresaId, nome, responsavelId)
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
      `SELECT id, nome FROM departamentos WHERE empresaId = ? ORDER BY nome`,
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
      FROM relacao_empresas r
      JOIN usuarios u ON u.id = r.usuarioId
      WHERE r.empresaId = ?
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
      JOIN relacao_empresas r ON u.id = r.usuarioId
      LEFT JOIN cargos c ON r.cargoId = c.id
      WHERE r.departamentoId = ?
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
      SELECT d.id, d.nome, d.dataCriacao,
       d.responsavelId,
       re.usuarioId AS responsavelUsuarioId,      -- ADICIONE ESSA LINHA
       u.nome AS responsavelNome
FROM departamentos d
LEFT JOIN relacao_empresas re ON d.responsavelId = re.id
LEFT JOIN usuarios u ON u.id = re.usuarioId
WHERE d.empresaId = ?
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
      "SELECT departamentoGlobalId FROM departamentos WHERE id = ?",
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
      `UPDATE departamentos SET nome = ?, responsavelId = ? WHERE id = ?`,
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
      `SELECT * FROM relacao_empresas WHERE id = ?`,
      [id]
    );

    if (!relacao) {
      return res.status(404).json({ error: "Funcionário não encontrado na relação." });
    }

    // Atualiza o departamento
    await db.query(
      `UPDATE relacao_empresas SET departamentoId = ? WHERE id = ?`,
      [departamentoId || null, id] // permite definir como NULL
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
      `SELECT * FROM relacao_empresas WHERE usuarioId = ?`,
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
      `SELECT * FROM relacao_empresas WHERE id = ?`,
      [id]
    );

    if (!relacao) {
      return res.status(404).json({ error: "Relação não encontrada." });
    }

    // Deleta a relação
    await db.query(
      `DELETE FROM relacao_empresas WHERE id = ?`,
      [id]
    );

    res.json({ message: "Funcionário removido da empresa com sucesso." });
  } catch (err) {
    console.error("Erro ao remover funcionário:", err);
    res.status(500).json({ error: "Erro interno ao remover funcionário da empresa." });
  }
});


module.exports = router;
