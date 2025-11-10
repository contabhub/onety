const express = require("express");
const router = express.Router();
const pool = require("../../config/database");
const verifyToken = require("../../middlewares/auth");

// ===== ROTAS PARA ANÁLISES GERAIS =====

// GET /analyses - Listar análises gerais (Simples Nacional + Regime Normal)
router.get("/", verifyToken, async (req, res) => {
  try {
    const {
      company_id,
      clientes_id,
      cnpj,
      ano,
      mes,
      tipo,
      sort_by = "created_at",
      sort_order = "desc",
    } = req.query;

    const companyId = company_id ? parseInt(company_id, 10) : null;
    const clientesId = clientes_id ? parseInt(clientes_id, 10) : null;
    const anoInt = ano ? parseInt(ano, 10) : null;
    const mesInt = mes ? parseInt(mes, 10) : null;
    const cnpjLimpo = cnpj ? cnpj.replace(/\D/g, "") : null;

    if (!companyId && !clientesId) {
      return res.status(400).json({
        error: "company_id ou clientes_id é obrigatório",
      });
    }

    const camposOrdenacao = ["cnpj", "created_at", "updated_at", "mes", "ano", "tipo"];
    const campoOrdenacao = camposOrdenacao.includes(sort_by) ? sort_by : "created_at";
    const direcaoOrdenacao = sort_order === "asc" ? "ASC" : "DESC";

    const filtrosSimples = [];
    const paramsSimples = [];

    if (clientesId) {
      filtrosSimples.push("asn.cliente_id = ?");
      paramsSimples.push(clientesId);
    } else if (companyId) {
      filtrosSimples.push("c.empresa_id = ?");
      paramsSimples.push(companyId);
    }

    if (cnpjLimpo) {
      filtrosSimples.push("asn.cnpj = ?");
      paramsSimples.push(cnpjLimpo);
    }

    if (anoInt) {
      filtrosSimples.push("asn.ano = ?");
      paramsSimples.push(anoInt);
    }

    if (mesInt) {
      filtrosSimples.push("asn.mes = ?");
      paramsSimples.push(mesInt);
    }

    if (tipo) {
      filtrosSimples.push("asn.tipo = ?");
      paramsSimples.push(tipo);
    }

    const whereSimples = filtrosSimples.length ? `WHERE ${filtrosSimples.join(" AND ")}` : "";

    const filtrosRegime = [];
    const paramsRegime = [];

    if (clientesId) {
      filtrosRegime.push("arn.cliente_id = ?");
      paramsRegime.push(clientesId);
    } else if (companyId) {
      filtrosRegime.push("c.empresa_id = ?");
      paramsRegime.push(companyId);
    }

    if (cnpjLimpo) {
      filtrosRegime.push("arn.cnpj = ?");
      paramsRegime.push(cnpjLimpo);
    }

    if (anoInt) {
      filtrosRegime.push("arn.ano = ?");
      paramsRegime.push(anoInt);
    }

    if (mesInt) {
      filtrosRegime.push("arn.mes = ?");
      paramsRegime.push(mesInt);
    }

    if (tipo) {
      filtrosRegime.push("arn.tipo = ?");
      paramsRegime.push(tipo);
    }

    const whereRegime = filtrosRegime.length ? `WHERE ${filtrosRegime.join(" AND ")}` : "";

    const consultaSimples = `
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
      ${whereSimples}
    `;

    const consultaRegime = `
      SELECT
        arn.id,
        arn.cliente_id AS clientes_id,
        arn.cnpj,
        arn.arquivo_nome,
        arn.tipo,
        arn.mes,
        arn.ano,
        arn.resumo,
        arn.criado_em AS created_at,
        arn.atualizado_em AS updated_at,
        c.id AS cliente_id,
        COALESCE(c.nome_fantasia, c.razao_social, c.apelido) AS cliente_nome,
        c.cpf_cnpj AS cliente_cnpj,
        c.estado AS cliente_uf,
        c.empresa_id AS cliente_company_id
      FROM analises_regime_normal AS arn
      INNER JOIN clientes AS c ON c.id = arn.cliente_id
      ${whereRegime}
    `;

    const [simplesRows, regimeRows] = await Promise.all([
      pool.query(consultaSimples, paramsSimples),
      pool.query(consultaRegime, paramsRegime),
    ]);

    const listaSimples = simplesRows[0].map((row) => ({
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
      regime: "simples_nacional",
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

    const listaRegime = regimeRows[0].map((row) => ({
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
      regime: "regime_normal",
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

    const todasAnalises = [...listaSimples, ...listaRegime];

    todasAnalises.sort((a, b) => {
      const valorA = a[campoOrdenacao];
      const valorB = b[campoOrdenacao];

      if (valorA == null && valorB == null) return 0;
      if (valorA == null) return direcaoOrdenacao === "ASC" ? -1 : 1;
      if (valorB == null) return direcaoOrdenacao === "ASC" ? 1 : -1;

      if (valorA > valorB) return direcaoOrdenacao === "ASC" ? 1 : -1;
      if (valorA < valorB) return direcaoOrdenacao === "ASC" ? -1 : 1;
      return 0;
    });

    res.json({ data: todasAnalises });
  } catch (err) {
    console.error("Erro ao buscar análises:", err);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

// GET /analyses/:id - Buscar análise específica
router.get("/:id", verifyToken, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);

    if (Number.isNaN(id)) {
      return res.status(400).json({ error: "ID inválido" });
    }

    const consultaDetalhe = (tabela, alias) => `
      SELECT
        ${alias}.id,
        ${alias}.cliente_id AS clientes_id,
        ${alias}.cnpj,
        ${alias}.arquivo_nome,
        ${alias}.tipo,
        ${alias}.mes,
        ${alias}.ano,
        ${alias}.resumo,
        ${alias}.criado_em AS created_at,
        ${alias}.atualizado_em AS updated_at,
        c.id AS cliente_id,
        COALESCE(c.nome_fantasia, c.razao_social, c.apelido) AS cliente_nome,
        c.cpf_cnpj AS cliente_cnpj,
        c.estado AS cliente_uf,
        c.empresa_id AS cliente_company_id
      FROM ${tabela} AS ${alias}
      INNER JOIN clientes AS c ON c.id = ${alias}.cliente_id
      WHERE ${alias}.id = ?
      LIMIT 1
    `;

    const [[simplesRow]] = await pool.query(
      consultaDetalhe("analises_simples_nacional", "asn"),
      [id]
    );

    if (simplesRow) {
      return res.json({
        id: simplesRow.id,
        clientes_id: simplesRow.clientes_id,
        cnpj: simplesRow.cnpj,
        arquivo_nome: simplesRow.arquivo_nome,
        tipo: simplesRow.tipo,
        mes: simplesRow.mes,
        ano: simplesRow.ano,
        resumo: simplesRow.resumo,
        created_at: simplesRow.created_at,
        updated_at: simplesRow.updated_at,
        regime: "simples_nacional",
        clientes: simplesRow.cliente_id
          ? {
              id: simplesRow.cliente_id,
              nome: simplesRow.cliente_nome,
              cnpj: simplesRow.cliente_cnpj,
              uf: simplesRow.cliente_uf,
              company_id: simplesRow.cliente_company_id,
            }
          : null,
      });
    }

    const [[regimeRow]] = await pool.query(
      consultaDetalhe("analises_regime_normal", "arn"),
      [id]
    );

    if (regimeRow) {
      return res.json({
        id: regimeRow.id,
        clientes_id: regimeRow.clientes_id,
        cnpj: regimeRow.cnpj,
        arquivo_nome: regimeRow.arquivo_nome,
        tipo: regimeRow.tipo,
        mes: regimeRow.mes,
        ano: regimeRow.ano,
        resumo: regimeRow.resumo,
        created_at: regimeRow.created_at,
        updated_at: regimeRow.updated_at,
        regime: "regime_normal",
        clientes: regimeRow.cliente_id
          ? {
              id: regimeRow.cliente_id,
              nome: regimeRow.cliente_nome,
              cnpj: regimeRow.cliente_cnpj,
              uf: regimeRow.cliente_uf,
              company_id: regimeRow.cliente_company_id,
            }
          : null,
      });
    }

    return res.status(404).json({ error: "Análise não encontrada" });
  } catch (err) {
    console.error("Erro ao buscar análise:", err);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

module.exports = router;

