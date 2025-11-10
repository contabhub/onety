const express = require("express");
const router = express.Router();
const pool = require("../../config/database");
const { verifyToken } = require("../../middlewares/auth");

// ===== ROTAS PARA TABELA NCMS_ANALISES =====

// POST /ncms-analises - Criar nova análise NCM
router.post("/", verifyToken, async (req, res) => {
  try {
    const { company_id, ncm, search_result, estado_origem, estado_destino } = req.body;

    if (!company_id || !ncm) {
      return res.status(400).json({
        error: "Campos obrigatórios: company_id, ncm",
      });
    }

    const companyId = parseInt(company_id, 10);

    if (Number.isNaN(companyId)) {
      return res.status(400).json({ error: "company_id inválido" });
    }

    const [clienteRows] = await pool.query(
      `
        SELECT id
        FROM clientes
        WHERE empresa_id = ?
        ORDER BY id ASC
        LIMIT 1
      `,
      [companyId]
    );

    if (!clienteRows.length) {
      return res.status(400).json({
        error: "Nenhum cliente encontrado para esta empresa",
      });
    }

    const clienteId = clienteRows[0].id;

    const condicoesDuplicidade = ["cliente_id = ?", "ncm = ?"];
    const paramsDuplicidade = [clienteId, ncm];

    if (estado_origem) {
      condicoesDuplicidade.push("estado_origem = ?");
      paramsDuplicidade.push(estado_origem);
    } else {
      condicoesDuplicidade.push("estado_origem IS NULL");
    }

    if (estado_destino) {
      condicoesDuplicidade.push("estado_destino = ?");
      paramsDuplicidade.push(estado_destino);
    } else {
      condicoesDuplicidade.push("estado_destino IS NULL");
    }

    const [duplicados] = await pool.query(
      `
        SELECT id
        FROM ncms_analises
        WHERE ${condicoesDuplicidade.join(" AND ")}
        LIMIT 1
      `,
      paramsDuplicidade
    );

    if (duplicados.length) {
      return res.status(400).json({
        error: "NCM já existe para esta combinação de estados",
      });
    }

    const [insercao] = await pool.query(
      `
        INSERT INTO ncms_analises (
          cliente_id,
          ncm,
          search_result,
          estado_origem,
          estado_destino,
          criado_por,
          atualizado_por
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      [
        clienteId,
        ncm,
        search_result,
        estado_origem || null,
        estado_destino || null,
        req.user.userId,
        req.user.userId,
      ]
    );

    const [registro] = await pool.query(
      `
        SELECT
          na.id,
          na.cliente_id,
          na.ncm,
          na.search_result,
          na.estado_origem,
          na.estado_destino,
          na.criado_em AS created_at,
          na.atualizado_em AS updated_at,
          c.empresa_id AS company_id
        FROM ncms_analises na
        INNER JOIN clientes c ON c.id = na.cliente_id
        WHERE na.id = ?
        LIMIT 1
      `,
      [insercao.insertId]
    );

    res.status(201).json(registro[0]);
  } catch (err) {
    console.error("Erro ao criar NCM:", err);
    res.status(500).json({ error: "Erro interno do servidor." });
  }
});

// GET /ncms-analises - Listar análises NCM com filtros
router.get("/", verifyToken, async (req, res) => {
  try {
    const {
      company_id,
      ncm,
      search_result,
      estado_origem,
      estado_destino,
      sort_by = "created_at",
      sort_order = "desc",
    } = req.query;

    if (!company_id) {
      return res.status(400).json({
        error: "company_id é obrigatório",
      });
    }

    const companyId = parseInt(company_id, 10);

    if (Number.isNaN(companyId)) {
      return res.status(400).json({ error: "company_id inválido" });
    }

    const filtros = ["c.empresa_id = ?"];
    const params = [companyId];

    if (ncm) {
      filtros.push("na.ncm LIKE ?");
      params.push(`%${ncm}%`);
    }

    if (search_result) {
      filtros.push("na.search_result LIKE ?");
      params.push(`%${search_result}%`);
    }

    if (estado_origem) {
      filtros.push("na.estado_origem = ?");
      params.push(estado_origem.toUpperCase());
    }

    if (estado_destino) {
      filtros.push("na.estado_destino = ?");
      params.push(estado_destino.toUpperCase());
    }

    const whereClause = filtros.length ? `WHERE ${filtros.join(" AND ")}` : "";

    const camposOrdenacao = [
      "ncm",
      "search_result",
      "estado_origem",
      "estado_destino",
      "created_at",
      "updated_at",
    ];
    const campoOrdenacao = camposOrdenacao.includes(sort_by) ? sort_by : "created_at";
    const direcaoOrdenacao = sort_order === "asc" ? "ASC" : "DESC";

    const [rows] = await pool.query(
      `
        SELECT
          na.id,
          na.cliente_id,
          na.ncm,
          na.search_result,
          na.estado_origem,
          na.estado_destino,
          na.criado_em AS created_at,
          na.atualizado_em AS updated_at,
          c.empresa_id AS company_id
        FROM ncms_analises na
        INNER JOIN clientes c ON c.id = na.cliente_id
        ${whereClause}
        ORDER BY ${campoOrdenacao} ${direcaoOrdenacao}
      `,
      params
    );

    const [[contagem]] = await pool.query(
      `
        SELECT COUNT(*) AS total
        FROM ncms_analises na
        INNER JOIN clientes c ON c.id = na.cliente_id
        ${whereClause}
      `,
      params
    );

    res.json({
      data: rows,
      pagination: {
        total: contagem?.total || 0,
      },
    });
  } catch (err) {
    console.error("Erro ao buscar NCM:", err);
    res.status(500).json({ error: "Erro interno do servidor." });
  }
});

// GET /ncms-analises/:id - Buscar NCM por ID
router.get("/:id", verifyToken, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);

    if (Number.isNaN(id)) {
      return res.status(400).json({ error: "ID inválido." });
    }

    const [rows] = await pool.query(
      `
        SELECT
          na.id,
          na.cliente_id,
          na.ncm,
          na.search_result,
          na.estado_origem,
          na.estado_destino,
          na.criado_em AS created_at,
          na.atualizado_em AS updated_at,
          c.empresa_id AS company_id
        FROM ncms_analises na
        INNER JOIN clientes c ON c.id = na.cliente_id
        WHERE na.id = ?
        LIMIT 1
      `,
      [id]
    );

    if (!rows.length) {
      return res.status(404).json({ error: "NCM não encontrado." });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error("Erro ao buscar NCM:", err);
    res.status(500).json({ error: "Erro interno do servidor." });
  }
});

// PUT /ncms-analises/:id - Atualizar NCM
router.put("/:id", verifyToken, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { ncm, search_result, estado_origem, estado_destino } = req.body;

    if (Number.isNaN(id)) {
      return res.status(400).json({ error: "ID inválido." });
    }

    if (!ncm) {
      return res.status(400).json({
        error: "Campo obrigatório: ncm",
      });
    }

    const [existentes] = await pool.query(
      `
        SELECT
          na.id,
          na.cliente_id,
          c.empresa_id AS company_id
        FROM ncms_analises na
        INNER JOIN clientes c ON c.id = na.cliente_id
        WHERE na.id = ?
        LIMIT 1
      `,
      [id]
    );

    if (!existentes.length) {
      return res.status(404).json({ error: "NCM não encontrado." });
    }

    const existente = existentes[0];

    if (
      !req.user.all_company_ids ||
      !req.user.all_company_ids.includes(existente.company_id)
    ) {
      return res.status(403).json({ error: "Acesso negado." });
    }

    const condicoesDuplicidade = ["cliente_id = ?", "ncm = ?", "id <> ?"];
    const paramsDuplicidade = [existente.cliente_id, ncm, id];

    if (estado_origem) {
      condicoesDuplicidade.push("estado_origem = ?");
      paramsDuplicidade.push(estado_origem);
    } else {
      condicoesDuplicidade.push("estado_origem IS NULL");
    }

    if (estado_destino) {
      condicoesDuplicidade.push("estado_destino = ?");
      paramsDuplicidade.push(estado_destino);
    } else {
      condicoesDuplicidade.push("estado_destino IS NULL");
    }

    const [duplicados] = await pool.query(
      `
        SELECT id
        FROM ncms_analises
        WHERE ${condicoesDuplicidade.join(" AND ")}
        LIMIT 1
      `,
      paramsDuplicidade
    );

    if (duplicados.length) {
      return res.status(400).json({
        error: "NCM já existe para esta empresa com os estados informados",
      });
    }

    await pool.query(
      `
        UPDATE ncms_analises
        SET
          ncm = ?,
          search_result = ?,
          estado_origem = ?,
          estado_destino = ?,
          atualizado_por = ?
        WHERE id = ?
      `,
      [ncm, search_result || null, estado_origem || null, estado_destino || null, req.user.userId, id]
    );

    const [atualizado] = await pool.query(
      `
        SELECT
          na.id,
          na.cliente_id,
          na.ncm,
          na.search_result,
          na.estado_origem,
          na.estado_destino,
          na.criado_em AS created_at,
          na.atualizado_em AS updated_at,
          c.empresa_id AS company_id
        FROM ncms_analises na
        INNER JOIN clientes c ON c.id = na.cliente_id
        WHERE na.id = ?
        LIMIT 1
      `,
      [id]
    );

    res.json(atualizado[0]);
  } catch (err) {
    console.error("Erro ao atualizar NCM:", err);
    res.status(500).json({ error: "Erro interno do servidor." });
  }
});

// DELETE /ncms-analises/:id - Deletar NCM
router.delete("/:id", verifyToken, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);

    if (Number.isNaN(id)) {
      return res.status(400).json({ error: "ID inválido." });
    }

    const [existentes] = await pool.query(
      `
        SELECT
          na.id,
          c.empresa_id AS company_id
        FROM ncms_analises na
        INNER JOIN clientes c ON c.id = na.cliente_id
        WHERE na.id = ?
        LIMIT 1
      `,
      [id]
    );

    if (!existentes.length) {
      return res.status(404).json({ error: "NCM não encontrado." });
    }

    const existente = existentes[0];

    if (
      !req.user.all_company_ids ||
      !req.user.all_company_ids.includes(existente.company_id)
    ) {
      return res.status(403).json({ error: "Acesso negado." });
    }

    const [resultado] = await pool.query(
      `
        DELETE FROM ncms_analises
        WHERE id = ?
      `,
      [id]
    );

    if (resultado.affectedRows === 0) {
      return res.status(404).json({ error: "NCM não encontrado." });
    }

    res.json({ message: "NCM deletado com sucesso." });
  } catch (err) {
    console.error("Erro ao deletar NCM:", err);
    res.status(500).json({ error: "Erro interno do servidor." });
  }
});

module.exports = router;
