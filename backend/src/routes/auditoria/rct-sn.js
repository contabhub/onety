const express = require("express");
const router = express.Router();
const pool = require("../../config/database");
const { verifyToken } = require("../../middlewares/auth");

// ===== ROTAS PARA RCT-SN (Relatório de Controle Tributário - Simples Nacional) =====

// GET /rct-sn - Listar análises RCT-SN
router.get("/", verifyToken, async (req, res) => {
  try {
    const { company_id, cnpj, ano, mes, sort_by = "created_at", sort_order = "desc" } = req.query;

    const companyId = company_id ? parseInt(company_id, 10) : null;
    const anoInt = ano ? parseInt(ano, 10) : null;
    const mesInt = mes ? parseInt(mes, 10) : null;
    const cnpjLimpo = cnpj ? cnpj.replace(/\D/g, "") : null;

    if (!companyId) {
      return res.status(400).json({
        error: "company_id é obrigatório",
      });
    }

    const filtros = ["c.empresa_id = ?", "asn.tipo = 'RCT-SN'"];
    const params = [companyId];

    if (cnpjLimpo) {
      filtros.push("asn.cnpj = ?");
      params.push(cnpjLimpo);
    }

    if (anoInt) {
      filtros.push("asn.ano = ?");
      params.push(anoInt);
    }

    if (mesInt) {
      filtros.push("asn.mes = ?");
      params.push(mesInt);
    }

    const whereClause = filtros.length ? `WHERE ${filtros.join(" AND ")}` : "";

    const camposOrdenacao = ["cnpj", "created_at", "updated_at", "mes", "ano"];
    const campoOrdenacao = camposOrdenacao.includes(sort_by) ? sort_by : "created_at";
    const direcaoOrdenacao = sort_order === "asc" ? "ASC" : "DESC";

    const [rows] = await pool.query(
      `
        SELECT
          asn.id,
          asn.cliente_id AS clientes_id,
          asn.cnpj,
          asn.arquivo_nome,
          asn.tipo,
          asn.mes,
          asn.ano,
          asn.criado_em AS created_at,
          asn.atualizado_em AS updated_at,
          c.id AS cliente_id,
          COALESCE(c.nome_fantasia, c.razao_social, c.apelido) AS cliente_nome,
          c.cpf_cnpj AS cliente_cnpj,
          c.estado AS cliente_uf,
          c.empresa_id AS cliente_company_id
        FROM analises_simples_nacional AS asn
        INNER JOIN clientes AS c ON c.id = asn.cliente_id
        ${whereClause}
        ORDER BY ${campoOrdenacao} ${direcaoOrdenacao}
      `,
      params
    );

    const [[contagem]] = await pool.query(
      `
        SELECT COUNT(*) AS total
        FROM analises_simples_nacional AS asn
        INNER JOIN clientes AS c ON c.id = asn.cliente_id
        ${whereClause}
      `,
      params
    );

    const analises = rows.map((row) => ({
      id: row.id,
      clientes_id: row.clientes_id,
      cnpj: row.cnpj,
      arquivo_nome: row.arquivo_nome,
      tipo: row.tipo,
      mes: row.mes,
      ano: row.ano,
      created_at: row.created_at,
      updated_at: row.updated_at,
      clientes: row.cliente_id
        ? {
            id: row.cliente_id,
            nome: row.cliente_nome,
            cnpj: row.cliente_cnpj,
            uf: row.cliente_uf,
            company_id: row.cliente_company_id,
          }
        : null,
    }));

    res.json({
      data: analises,
      pagination: {
        total: contagem?.total || 0,
      },
    });
  } catch (err) {
    console.error("Erro ao buscar análises RCT-SN:", err);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

// GET /rct-sn/:id - Buscar análise RCT-SN específica
router.get("/:id", verifyToken, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);

    if (Number.isNaN(id)) {
      return res.status(400).json({ error: "ID inválido" });
    }

    const [rows] = await pool.query(
      `
        SELECT
          asn.id,
          asn.cliente_id AS clientes_id,
          asn.cnpj,
          asn.arquivo_nome,
          asn.tipo,
          asn.mes,
          asn.ano,
          asn.resumo,
          asn.criado_em AS created_at,
          asn.atualizado_em AS updated_at,
          c.id AS cliente_id,
          COALESCE(c.nome_fantasia, c.razao_social, c.apelido) AS cliente_nome,
          c.cpf_cnpj AS cliente_cnpj,
          c.estado AS cliente_uf,
          c.empresa_id AS cliente_company_id
        FROM analises_simples_nacional AS asn
        INNER JOIN clientes AS c ON c.id = asn.cliente_id
        WHERE asn.id = ?
          AND asn.tipo = 'RCT-SN'
        LIMIT 1
      `,
      [id]
    );

    if (!rows.length) {
      return res.status(404).json({ error: "Análise RCT-SN não encontrada" });
    }

    const row = rows[0];

    res.json({
      id: row.id,
      clientes_id: row.clientes_id,
      cnpj: row.cnpj,
      arquivo_nome: row.arquivo_nome,
      tipo: row.tipo,
      mes: row.mes,
      ano: row.ano,
      resumo: row.resumo,
      created_at: row.created_at,
      updated_at: row.updated_at,
      clientes: row.cliente_id
        ? {
            id: row.cliente_id,
            nome: row.cliente_nome,
            cnpj: row.cliente_cnpj,
            uf: row.cliente_uf,
            company_id: row.cliente_company_id,
          }
        : null,
    });
  } catch (err) {
    console.error("Erro ao buscar análise RCT-SN:", err);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

module.exports = router;

