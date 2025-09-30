const express = require("express");
const pool = require("../../config/database");
const verifyToken = require("../../middlewares/auth");
const { verificarPermissao } = require("../../middlewares/permissao");

const router = express.Router();

function getEmpresaId(req) {
  return (
    (req.body && (req.body.empresa_id || req.body.empresaId)) ||
    req.headers["x-empresa-id"] ||
    null
  );
}

// Criar novo cargo
router.post(
  "/",
  verifyToken,
  async (req, res) => {
    try {
      const empresa_id = Number(getEmpresaId(req));
      const { nome, descricao = null, permissoes = {}, permissoes_modulos = [] } =
        req.body || {};

      if (!empresa_id || !nome) {
        return res
          .status(400)
          .json({ error: "Campos obrigatórios: empresa_id (no body) e nome." });
      }

      const [result] = await pool.query(
        `INSERT INTO cargos (nome, descricao, empresa_id, permissoes, permissoes_modulos)
         VALUES (?,?,?,?,?)`,
        [
          nome,
          descricao,
          empresa_id,
          JSON.stringify(permissoes || {}),
          JSON.stringify(permissoes_modulos || []),
        ]
      );

      res.status(201).json({ id: result.insertId, message: "Cargo criado com sucesso!" });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Erro interno ao criar cargo." });
    }
  }
);

// Listar cargos da empresa
router.get(
  "/",
  verifyToken,
  verificarPermissao("cargos.visualizar"),
  async (req, res) => {
  try {
    const empresa_id = Number(getEmpresaId(req));
    if (!empresa_id) return res.status(400).json({ error: "Informe empresa_id (no body)." });

    const [rows] = await pool.query(
      `SELECT id, nome, descricao, empresa_id, permissoes, permissoes_modulos,
              criado_em, atualizado_em
       FROM cargos
       WHERE empresa_id = ?`,
      [empresa_id]
    );

    const data = rows.map((c) => ({
      ...c,
      permissoes:
        typeof c.permissoes === "string" ? JSON.parse(c.permissoes || "{}") : c.permissoes || {},
      permissoes_modulos:
        typeof c.permissoes_modulos === "string"
          ? JSON.parse(c.permissoes_modulos || "[]")
          : c.permissoes_modulos || [],
    }));

    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro interno ao listar cargos." });
  }
});

// Detalhar um cargo
router.get(
  "/:id",
  verifyToken,
  verificarPermissao("cargos.visualizar"),
  async (req, res) => {
    try {
      const { id } = req.params;
      const empresa_id = Number(getEmpresaId(req));
      if (!empresa_id) return res.status(400).json({ error: "Informe empresa_id (no body)." });

      const [rows] = await pool.query(
        `SELECT * FROM cargos WHERE id = ? AND empresa_id = ? LIMIT 1`,
        [id, empresa_id]
      );
      if (!rows.length) return res.status(404).json({ error: "Cargo não encontrado." });

      const c = rows[0];
      c.permissoes = typeof c.permissoes === "string" ? JSON.parse(c.permissoes || "{}") : c.permissoes || {};
      c.permissoes_modulos =
        typeof c.permissoes_modulos === "string"
          ? JSON.parse(c.permissoes_modulos || "[]")
          : c.permissoes_modulos || [];
      res.json(c);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Erro interno ao buscar cargo." });
    }
  }
);

// Atualizar cargo
router.put(
  "/:id",
  verifyToken,
  verificarPermissao("cargos.editar"),
  async (req, res) => {
    try {
      const { id } = req.params;
      const empresa_id = Number(getEmpresaId(req));
      const { nome, descricao = null, permissoes = {}, permissoes_modulos = [] } = req.body || {};
      if (!empresa_id) return res.status(400).json({ error: "Informe empresa_id (no body)." });

      await pool.query(
        `UPDATE cargos SET nome = ?, descricao = ?, permissoes = ?, permissoes_modulos = ?, atualizado_em = NOW()
         WHERE id = ? AND empresa_id = ?`,
        [
          nome,
          descricao,
          JSON.stringify(permissoes || {}),
          JSON.stringify(permissoes_modulos || []),
          id,
          empresa_id,
        ]
      );

      res.json({ message: "Cargo atualizado com sucesso!" });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Erro interno ao atualizar cargo." });
    }
  }
);

// Remover cargo (bloqueia se houver vínculos em usuarios_empresas)
router.delete(
  "/:id",
  verifyToken,
  verificarPermissao("cargos.excluir"),
  async (req, res) => {
    try {
      const { id } = req.params;
      const empresa_id = Number(getEmpresaId(req));
      if (!empresa_id) return res.status(400).json({ error: "Informe empresa_id (no body)." });

      const [rel] = await pool.query(
        `SELECT id FROM usuarios_empresas WHERE cargo_id = ? AND empresa_id = ? LIMIT 1`,
        [id, empresa_id]
      );
      if (rel.length) return res.status(400).json({ error: "Existem usuários vinculados a este cargo." });

      await pool.query(`DELETE FROM cargos WHERE id = ? AND empresa_id = ?`, [id, empresa_id]);
      res.json({ message: "Cargo deletado com sucesso." });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Erro interno ao deletar cargo." });
    }
  }
);

module.exports = router;


