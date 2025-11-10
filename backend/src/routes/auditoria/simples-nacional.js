const express = require("express");
const router = express.Router();
const pool = require("../../config/database");
const { verifyToken } = require("../../middlewares/auth");
const consultaCnaeService = require("../../services/auditoria/ConsultaCnae");

const sanitizeCnpj = (value) => (value ? value.replace(/\D/g, "") : null);

const parseJSONSafely = (value) => {
  if (value == null) return null;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};
  
// ===== ROTAS PARA SIMPLES NACIONAL =====

// POST /simples-nacional/upload - Upload de PDF do Simples Nacional
router.post("/upload", verifyToken, async (req, res) => {
  try {
    const { 
      cnpj,
      nome_empresa,
      atividade_principal,
      uf,
      fator_r_status,
      periodo_documento,
      icms_percentage,
      pis_cofins_percentage,
      receita_total,
      icms_total,
      pis_total,
      cofins_total,
      valor_das,
      anexos_simples,
      valor_folha,
      folha_de_salarios_anteriores,
      date_pag,
      resultado_api,
      arquivo_nome,
      mes,
      ano,
      company_id // Adicionar company_id do body
    } = req.body;

    // Validações obrigatórias
    if (!cnpj || !nome_empresa || !fator_r_status) {
      return res.status(400).json({ 
        error: "Campos obrigatórios: cnpj, nome_empresa, fator_r_status" 
      });
    }

    // Validar formato do CNPJ (14 dígitos)
    if (!/^\d{14}$/.test(cnpj.replace(/\D/g, ''))) {
      return res.status(400).json({ 
        error: "CNPJ deve ter 14 dígitos" 
      });
    }

    const cleanCnpj = cnpj.replace(/\D/g, '');

    let clienteId;
    try {
      const companyIdsUser = Array.isArray(req.user.all_company_ids) ? req.user.all_company_ids : [];
      let targetCompanyId = company_id ? Number.parseInt(company_id, 10) : null;

      if (targetCompanyId) {
        if (!companyIdsUser.includes(targetCompanyId)) {
          return res.status(403).json({ error: "Acesso negado a esta empresa" });
        }
      } else if (req.user.company_id) {
        targetCompanyId = req.user.company_id;
      } else if (companyIdsUser.length === 1) {
        targetCompanyId = companyIdsUser[0];
      } else {
        return res.status(400).json({ error: "Company ID não fornecido" });
      }

      const [clienteRows] = await pool.query(
        `
          SELECT id, cpf_cnpj, empresa_id
          FROM clientes
          WHERE empresa_id = ?
            AND REPLACE(REPLACE(REPLACE(cpf_cnpj, '.', ''), '-', ''), '/', '') = ?
            AND regime_tributario = 'simples_nacional'
        `,
        [targetCompanyId, cleanCnpj]
      );

      if (clienteRows.length) {
        const cliente = clienteRows[0];
        clienteId = cliente.id;
        await pool.query(
          `
            UPDATE clientes
            SET nome_fantasia = ?, razao_social = ?, estado = ?, atualizado_em = NOW()
            WHERE id = ?
          `,
          [nome_empresa, nome_empresa, uf || "SP", clienteId]
        );
      } else {
        const [insertCliente] = await pool.query(
          `
            INSERT INTO clientes (
              empresa_id,
              cpf_cnpj,
              nome_fantasia,
              razao_social,
              estado,
              regime_tributario,
              criado_em,
              atualizado_em
            ) VALUES (?, ?, ?, ?, ?, 'simples_nacional', NOW(), NOW())
          `,
          [targetCompanyId, cleanCnpj, nome_empresa, nome_empresa, uf || "SP"]
        );
        clienteId = insertCliente.insertId;
      }

      try {
        const resultado = await consultaCnaeService.consultarCnaes(cleanCnpj);

        if (resultado?.cnaes?.length) {
          for (const cnae of resultado.cnaes) {
            const [existingCnae] = await pool.query(
              `
                SELECT id
                FROM cnae_info
                WHERE cliente_id = ?
                  AND cnae = ?
                LIMIT 1
              `,
              [clienteId, cnae.codigo]
            );

            if (!existingCnae.length) {
              await pool.query(
                `
                  INSERT INTO cnae_info (
                    cliente_id,
                    cnae,
                    descricao,
                    anexo,
                    fator_r,
                    aliquota,
                    criado_por,
                    atualizado_por
                  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `,
                [
                  clienteId,
                  cnae.codigo,
                  cnae.descricao,
                  cnae.anexo,
                  cnae.fator_r,
                  cnae.aliquota,
                  req.user.userId,
                  req.user.userId,
                ]
              );
            }
          }
        }
      } catch (error) {
        console.error("[Simples Nacional] Erro ao consultar CNAEs:", error);
      }
    } catch (error) {
      console.error("Erro ao processar cliente:", error);
      return res.status(500).json({ error: "Erro ao processar cliente" });
    }

    try {
      const resumo = {
        receita_total,
        icms_total,
        pis_total,
        cofins_total,
        fator_r_status,
        atividade_principal,
        periodo_documento,
      };

      const resultadoApiJSON =
        resultado_api && typeof resultado_api === "object"
          ? JSON.stringify(resultado_api)
          : JSON.stringify({});
      const anexosJSON =
        anexos_simples && typeof anexos_simples === "object"
          ? JSON.stringify(anexos_simples)
          : JSON.stringify(anexos_simples || null);
      const folhaAnteriorJSON = Array.isArray(folha_de_salarios_anteriores)
        ? JSON.stringify(folha_de_salarios_anteriores)
        : folha_de_salarios_anteriores || null;

      const [insertAnalise] = await pool.query(
        `
          INSERT INTO analises_simples_nacional (
            cliente_id,
            cnpj,
            arquivo_nome,
            tipo,
            mes,
            ano,
            resumo,
            data_extracao,
            resultado_api,
            fator_r_status,
            atividade_principal,
            canes,
            icms_porcentagem,
            pis_cofins_porcentagem,
            receita_total,
            icms_total,
            pis_total,
            cofins_total,
            periodo_documento,
            valor_das,
            anexos_simples,
            valor_folha,
            folha_de_salarios_anteriores,
            data_pag,
            criado_por,
            atualizado_por
          ) VALUES (?, ?, ?, 'PGDAS', ?, ?, ?, NOW(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          clienteId,
          cleanCnpj,
          arquivo_nome || "PDF Simples Nacional",
          mes || null,
          ano || null,
          JSON.stringify(resumo),
          resultadoApiJSON,
          fator_r_status,
          atividade_principal || "Não identificada",
          JSON.stringify(resultado_api?.cnaes_secundarios || []),
          icms_percentage,
          pis_cofins_percentage,
          receita_total,
          icms_total,
          pis_total,
          cofins_total,
          periodo_documento,
          valor_das,
          anexosJSON,
          valor_folha,
          folhaAnteriorJSON,
          date_pag || null,
          req.user.userId,
          req.user.userId,
        ]
      );

      res.status(201).json({
        success: true,
        message: "Análise do Simples Nacional criada com sucesso",
        data: {
          cliente_id: clienteId,
          analise_id: insertAnalise.insertId,
          cnpj: cleanCnpj,
          nome_empresa,
        },
      });
    } catch (error) {
      console.error("Erro ao criar análise:", error);
      res.status(500).json({ error: "Erro interno do servidor" });
    }

  } catch (err) {
    console.error('Erro no upload do Simples Nacional:', err);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

// GET /simples-nacional - Listar análises do Simples Nacional
router.get("/", verifyToken, async (req, res) => {
  try {
    const { 
      clientes_id,
      cnpj,
      company_id,
      ano,
      page = 1,
      limit = 50,
      sort_by = 'data_extracao',
      sort_order = 'desc'
    } = req.query;

    const pageNumber = Number.parseInt(page, 10) || 1;
    const limitNumber = Number.parseInt(limit, 10) || 50;
    const offset = (pageNumber - 1) * limitNumber;

    const companyIdsUser = Array.isArray(req.user.all_company_ids) ? req.user.all_company_ids : [];
    if (!companyIdsUser.length) {
      return res.status(403).json({ error: "Usuário não possui empresas associadas" });
    }

    let companiesToFilter = [...companyIdsUser];
    if (company_id) {
      const companyIdParsed = Number.parseInt(company_id, 10);
      if (!companyIdsUser.includes(companyIdParsed)) {
        return res.status(403).json({ error: "Acesso negado a esta empresa" });
      }
      companiesToFilter = [companyIdParsed];
    }

    const companyPlaceholders = companiesToFilter.map(() => "?").join(",");

    const [clientesRows] = await pool.query(
      `
        SELECT id
        FROM clientes
        WHERE empresa_id IN (${companyPlaceholders})
      `,
      companiesToFilter
    );

    if (!clientesRows.length) {
      return res.json({
        data: [],
        pagination: {
          page: pageNumber,
          limit: limitNumber,
          total: 0,
          total_pages: 0,
        },
      });
    }

    const clientesIds = clientesRows.map((row) => row.id);
    const clientesPlaceholders = clientesIds.map(() => "?").join(",");

    const filtros = [`asn.cliente_id IN (${clientesPlaceholders})`];
    const params = [...clientesIds];

    if (clientes_id) {
      filtros.push("asn.cliente_id = ?");
      params.push(Number.parseInt(clientes_id, 10));
    }

    if (cnpj) {
      const cleanCnpj = cnpj.replace(/\D/g, "");
      filtros.push("asn.cnpj = ?");
      params.push(cleanCnpj);
    }

    if (ano) {
      filtros.push("asn.ano = ?");
      params.push(Number.parseInt(ano, 10));
    }

    const whereClause = filtros.length ? `WHERE ${filtros.join(" AND ")}` : "";

    const camposOrdenacao = {
      cnpj: "asn.cnpj",
      data_extracao: "asn.data_extracao",
      fator_r_status: "asn.fator_r_status",
      periodo_documento: "asn.periodo_documento",
    };

    const sortColumn = camposOrdenacao[sort_by] || "asn.data_extracao";
    const sortDirection = sort_order === "asc" ? "ASC" : "DESC";

    const consulta = `
      SELECT
        asn.id,
        asn.cliente_id AS clientes_id,
        asn.cnpj,
        asn.arquivo_nome,
        asn.tipo,
        asn.mes,
        asn.ano,
        asn.resumo,
        asn.data_extracao,
        asn.resultado_api,
        asn.fator_r_status,
        asn.atividade_principal,
        asn.canes,
        asn.icms_porcentagem,
        asn.pis_cofins_porcentagem,
        asn.receita_total,
        asn.icms_total,
        asn.pis_total,
        asn.cofins_total,
        asn.periodo_documento,
        asn.valor_das,
        asn.anexos_simples,
        asn.valor_folha,
        asn.folha_de_salarios_anteriores,
        asn.data_pag,
        c.id AS cliente_id,
        COALESCE(c.nome_fantasia, c.razao_social, c.apelido) AS cliente_nome,
        c.cpf_cnpj AS cliente_cnpj,
        c.estado AS cliente_uf,
        c.empresa_id AS cliente_company_id
      FROM analises_simples_nacional AS asn
      INNER JOIN clientes AS c ON c.id = asn.cliente_id
      ${whereClause}
      ORDER BY ${sortColumn} ${sortDirection}
      LIMIT ?
      OFFSET ?
    `;

    const [rows] = await pool.query(consulta, [...params, limitNumber, offset]);

    const [[countRow]] = await pool.query(
      `
        SELECT COUNT(*) AS total
        FROM analises_simples_nacional AS asn
        INNER JOIN clientes AS c ON c.id = asn.cliente_id
        ${whereClause}
      `,
      params
    );

    const total = countRow?.total || 0;

    const data = rows.map((row) => ({
      id: row.id,
      clientes_id: row.clientes_id,
      cnpj: row.cnpj,
      arquivo_nome: row.arquivo_nome,
      tipo: row.tipo,
      mes: row.mes,
      ano: row.ano,
      resumo: parseJSONSafely(row.resumo),
      data_extracao: row.data_extracao,
      resultado_api: parseJSONSafely(row.resultado_api),
      fator_r_status: row.fator_r_status,
      atividade_principal: row.atividade_principal,
      cnaes: parseJSONSafely(row.canes),
      icms_percentage: row.icms_porcentagem,
      pis_cofins_percentage: row.pis_cofins_porcentagem,
      receita_total: row.receita_total,
      icms_total: row.icms_total,
      pis_total: row.pis_total,
      cofins_total: row.cofins_total,
      periodo_documento: row.periodo_documento,
      valor_das: row.valor_das,
      anexos_simples: parseJSONSafely(row.anexos_simples),
      valor_folha: row.valor_folha,
      folha_de_salarios_anteriores: parseJSONSafely(row.folha_de_salarios_anteriores),
      date_pag: row.data_pag,
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
      data,
      pagination: {
        page: pageNumber,
        limit: limitNumber,
        total,
        total_pages: Math.ceil(total / limitNumber),
      },
    });
  } catch (err) {
    console.error('Erro ao buscar análises do Simples Nacional:', err);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

// GET /simples-nacional/comparacao-anexos - Comparar anexos por empresa e período
router.get("/comparacao-anexos", verifyToken, async (req, res) => {
  try {
    const { clientes_id, cnpj, ano, mes, company_id } = req.query;

    const companyIdsUser = Array.isArray(req.user.all_company_ids) ? req.user.all_company_ids : [];
    if (!companyIdsUser.length) {
      return res.status(403).json({ error: "Usuário não possui empresas associadas" });
    }

    if (!clientes_id && !cnpj) {
      return res.status(400).json({ error: "clientes_id ou cnpj é obrigatório" });
    }

    let clienteRow = null;

    if (clientes_id) {
      const clienteId = Number.parseInt(clientes_id, 10);
      if (Number.isNaN(clienteId)) {
        return res.status(400).json({ error: "clientes_id inválido" });
      }

      const [clienteRows] = await pool.query(
        `
          SELECT id, empresa_id, nome_fantasia AS nome, cpf_cnpj AS cnpj, estado AS uf
          FROM clientes
          WHERE id = ?
            AND regime_tributario = 'simples_nacional'
        `,
        [clienteId]
      );

      if (!clienteRows.length || !companyIdsUser.includes(clienteRows[0].empresa_id)) {
        return res.status(404).json({ error: "Cliente não encontrado ou não está no Simples Nacional" });
      }

      clienteRow = clienteRows[0];
    } else if (cnpj) {
      const cleanCnpj = cnpj.replace(/\D/g, "");

      const companiesFilter = company_id
        ? [Number.parseInt(company_id, 10)]
        : companyIdsUser;

      if (companiesFilter.some((id) => !companyIdsUser.includes(id))) {
        return res.status(403).json({ error: "Acesso negado a esta empresa" });
      }

      const [clienteRows] = await pool.query(
        `
          SELECT id, empresa_id, nome_fantasia AS nome, cpf_cnpj AS cnpj, estado AS uf
          FROM clientes
          WHERE REPLACE(REPLACE(REPLACE(cpf_cnpj, '.', ''), '-', ''), '/', '') = ?
            AND regime_tributario = 'simples_nacional'
            AND empresa_id IN (${companiesFilter.map(() => "?").join(",")})
          LIMIT 1
        `,
        [cleanCnpj, ...companiesFilter]
      );

      if (!clienteRows.length) {
        return res.status(404).json({ error: "Cliente não encontrado ou não está no Simples Nacional" });
      }

      clienteRow = clienteRows[0];
    }

    const [cnaeRows] = await pool.query(
      `
        SELECT cnae, descricao, anexo, fator_r, aliquota
        FROM cnae_info
        WHERE cliente_id = ?
        ORDER BY id ASC
      `,
      [clienteRow.id]
    );

    const filtrosAnalise = ["asn.cliente_id = ?"];
    const paramsAnalise = [clienteRow.id];

    if (ano) {
      filtrosAnalise.push("asn.ano = ?");
      paramsAnalise.push(Number.parseInt(ano, 10));
    }

    if (mes) {
      filtrosAnalise.push("asn.mes = ?");
      paramsAnalise.push(Number.parseInt(mes, 10));
    }

    const whereAnalises = filtrosAnalise.length ? `WHERE ${filtrosAnalise.join(" AND ")}` : "";

    const [analisesRows] = await pool.query(
      `
        SELECT
          asn.mes,
          asn.ano,
          asn.anexos_simples,
          asn.fator_r_status,
          asn.periodo_documento
        FROM analises_simples_nacional AS asn
        INNER JOIN clientes AS c ON c.id = asn.cliente_id
        WHERE c.empresa_id = ?
          ${whereAnalises ? "AND " + filtrosAnalise.join(" AND ").replace("asn.cliente_id = ?", "asn.cliente_id = ?") : ""}
      `,
      [clienteRow.empresa_id, ...paramsAnalise]
    );

    const comparacaoAnexos = [];

    for (const analise of analisesRows) {
      const anexosExtrato = parseJSONSafely(analise.anexos_simples);
      const anexoExtrato = Array.isArray(anexosExtrato)
        ? anexosExtrato[0] || "Não informado"
        : anexosExtrato || "Não informado";
      const fatorRExtrato = analise.fator_r_status;

      const cnaePrincipal = cnaeRows?.[0];
      const anexoCnae = cnaePrincipal?.anexo || "Não encontrado";
      const fatorRCnae = cnaePrincipal?.fator_r || "Não encontrado";

      let status = "correto";
      let diferenca = "";
      let recomendacao = "";

      if (anexoExtrato !== anexoCnae) {
        status = "incorreto";
        diferenca = `Anexo do extrato (${anexoExtrato}) difere do anexo baseado no CNAE (${anexoCnae})`;
        recomendacao = `Verificar se o CNAE ${cnaePrincipal?.cnae} está correto ou se houve mudança de atividade`;
      }

      if (fatorRExtrato !== fatorRCnae) {
        diferenca += diferenca ? " | " : "";
        diferenca += `Fator R do extrato (${fatorRExtrato}) difere do Fator R baseado no CNAE (${fatorRCnae})`;
        recomendacao += recomendacao ? " | " : "";
        recomendacao += "Verificar se o Fator R está sendo aplicado corretamente";
      }

      comparacaoAnexos.push({
        mes: analise.mes,
        ano: analise.ano,
        anexoExtrato,
        anexoCnae,
        fatorRExtrato,
        fatorRCnae,
        diferenca,
        recomendacao,
        status,
        periodoDocumento: analise.periodo_documento,
      });
    }

    res.json({
      success: true,
      cliente: {
        id: clienteRow.id,
        nome: clienteRow.nome,
        cnpj: clienteRow.cnpj,
        uf: clienteRow.uf,
      },
      cnaes: cnaeRows || [],
      comparacaoAnexos,
      totalAnalises: analisesRows.length,
      inconsistencias: comparacaoAnexos.filter((item) => item.status === "incorreto").length,
    });
  } catch (err) {
    console.error("Erro ao comparar anexos:", err);
    res.status(500).json({
      error: "Erro interno do servidor ao comparar anexos",
      details: err.message,
    });
  }
});

// GET /simples-nacional/clientes - Listar clientes do Simples Nacional
router.get("/clientes", verifyToken, async (req, res) => {
  try {
    const {
      company_id,
      cnpj,
      uf,
      nome,
      page = 1,
      limit = 50,
      sort_by = "created_at",
      sort_order = "desc",
    } = req.query;

    const pageNumber = Number.parseInt(page, 10) || 1;
    const limitNumber = Number.parseInt(limit, 10) || 50;
    const offset = (pageNumber - 1) * limitNumber;

    const companyIdsUser = Array.isArray(req.user.all_company_ids) ? req.user.all_company_ids : [];
    if (!companyIdsUser.length) {
      return res.status(403).json({ error: "Usuário não possui empresas associadas" });
    }

    let companiesToFilter = [...companyIdsUser];
    if (company_id) {
      const companyIdParsed = Number.parseInt(company_id, 10);
      if (!companyIdsUser.includes(companyIdParsed)) {
        return res.status(403).json({ error: "Acesso negado a esta empresa" });
      }
      companiesToFilter = [companyIdParsed];
    }

    const cleanCnpj = cnpj ? cnpj.replace(/\D/g, "") : null;
    const ufParam = uf ? uf.toUpperCase() : null;
    const nomeParam = nome ? nome.trim() : null;

    const filtros = ["c.regime_tributario = 'simples_nacional'"];
    const params = [];

    filtros.push(`c.empresa_id IN (${companiesToFilter.map(() => "?").join(",")})`);
    params.push(...companiesToFilter);

    if (cleanCnpj) {
      filtros.push("REPLACE(REPLACE(REPLACE(c.cpf_cnpj, '.', ''), '-', ''), '/', '') = ?");
      params.push(cleanCnpj);
    }

    if (ufParam) {
      filtros.push("c.estado = ?");
      params.push(ufParam);
    }

    if (nomeParam) {
      filtros.push(
        "(c.nome_fantasia LIKE ? OR c.razao_social LIKE ? OR c.apelido LIKE ?)"
      );
      const likeValue = `%${nomeParam}%`;
      params.push(likeValue, likeValue, likeValue);
    }

    const whereClause = filtros.length ? `WHERE ${filtros.join(" AND ")}` : "";

    const camposOrdenacao = {
      nome: "COALESCE(c.nome_fantasia, c.razao_social, c.apelido)",
      cnpj: "c.cpf_cnpj",
      uf: "c.estado",
      created_at: "c.criado_em",
      updated_at: "c.atualizado_em",
    };
    const sortColumn = camposOrdenacao[sort_by] || "c.criado_em";
    const sortDirection = sort_order === "asc" ? "ASC" : "DESC";

    const consulta = `
      SELECT
        c.id,
        c.cpf_cnpj,
        c.nome_fantasia,
        c.razao_social,
        c.apelido,
        c.estado,
        c.regime_tributario,
        c.status,
        c.empresa_id,
        c.criado_em AS created_at,
        c.atualizado_em AS updated_at,
        COALESCE(c.nome_fantasia, c.razao_social, c.apelido) AS nome_exibicao
      FROM clientes c
      ${whereClause}
      ORDER BY ${sortColumn} ${sortDirection}
      LIMIT ?
      OFFSET ?
    `;

    const [rows] = await pool.query(consulta, [...params, limitNumber, offset]);

    const [[countRow]] = await pool.query(
      `
        SELECT COUNT(*) AS total
        FROM clientes c
        ${whereClause}
      `,
      params
    );

    const total = countRow?.total || 0;

    const data = rows.map((row) => ({
      id: row.id,
      cnpj: row.cpf_cnpj,
      cpf_cnpj: row.cpf_cnpj,
      nome_fantasia: row.nome_fantasia,
      razao_social: row.razao_social,
      apelido: row.apelido,
      nome: row.nome_exibicao,
      uf: row.estado,
      estado: row.estado,
      regime_tributario: row.regime_tributario,
      status: row.status,
      company_id: row.empresa_id,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));

    res.json({
      data,
      pagination: {
        page: pageNumber,
        limit: limitNumber,
        total,
        total_pages: Math.ceil(total / limitNumber),
      },
    });
  } catch (err) {
    console.error("Erro ao buscar clientes do Simples Nacional:", err);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

// GET /simples-nacional/das-mensais - Buscar dados de DAS mensais
router.get("/das-mensais", verifyToken, async (req, res) => {
  try {
    const { cnpj_emitente, ano, clientes_id, company_id } = req.query;

    if (!ano) {
      return res.status(400).json({ error: "Ano é obrigatório" });
    }

    const anoInt = Number.parseInt(ano, 10);
    if (Number.isNaN(anoInt)) {
      return res.status(400).json({ error: "Ano inválido" });
    }

    const companyIdsUser = Array.isArray(req.user.all_company_ids) ? req.user.all_company_ids : [];
    if (!companyIdsUser.length) {
      return res.status(403).json({ error: "Usuário não possui empresas associadas" });
    }

    let clienteRow = null;
    let companiesToFilter = [...companyIdsUser];

    if (clientes_id) {
      const clienteIdParsed = Number.parseInt(clientes_id, 10);
      if (Number.isNaN(clienteIdParsed)) {
        return res.status(400).json({ error: "clientes_id inválido" });
      }

      const [clienteRows] = await pool.query(
        `
          SELECT id, empresa_id
          FROM clientes
          WHERE id = ?
            AND regime_tributario = 'simples_nacional'
        `,
        [clienteIdParsed]
      );

      if (!clienteRows.length || !companyIdsUser.includes(clienteRows[0].empresa_id)) {
        return res.status(404).json({ error: "Cliente não encontrado" });
      }

      clienteRow = clienteRows[0];
      companiesToFilter = [clienteRow.empresa_id];
    } else if (cnpj_emitente) {
      const cleanCnpj = sanitizeCnpj(cnpj_emitente);
      if (!cleanCnpj) {
        return res.status(400).json({ error: "CNPJ inválido" });
      }

      if (company_id) {
        const companyIdParsed = Number.parseInt(company_id, 10);
        if (Number.isNaN(companyIdParsed) || !companyIdsUser.includes(companyIdParsed)) {
          return res.status(403).json({ error: "Acesso negado a esta empresa" });
        }
        companiesToFilter = [companyIdParsed];
      }

      const placeholders = companiesToFilter.map(() => "?").join(",");

      const [clienteRows] = await pool.query(
        `
          SELECT id, empresa_id
          FROM clientes
          WHERE REPLACE(REPLACE(REPLACE(cpf_cnpj, '.', ''), '-', ''), '/', '') = ?
            AND regime_tributario = 'simples_nacional'
            AND empresa_id IN (${placeholders})
          LIMIT 1
        `,
        [cleanCnpj, ...companiesToFilter]
      );

      if (!clienteRows.length) {
        return res.status(404).json({ error: "Cliente não encontrado" });
      }

      clienteRow = clienteRows[0];
    } else {
      return res.status(400).json({ error: "clientes_id ou cnpj_emitente é obrigatório" });
    }

    const [analisesRows] = await pool.query(
      `
        SELECT mes, ano, valor_das, data_pag
        FROM analises_simples_nacional
        WHERE cliente_id = ?
          AND ano = ?
        ORDER BY mes ASC
      `,
      [clienteRow.id, anoInt]
    );

    // Criar array com todos os 12 meses
    const nomesMeses = [
      "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
      "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
    ];

    const dasPorMes = [];

    for (let mes = 1; mes <= 12; mes++) {
      const analise = analisesRows?.find((a) => a.mes === mes);
      
      let status = "importacao_pendente";
      let dataPagamento = null;
      let valorDas = null;

      if (analise) {
        const dataPag = analise.data_pag || analise.date_pag;
        if (dataPag && String(dataPag).trim() !== "") {
          status = "pago";
          dataPagamento = dataPag;
        } else {
          status = "a_pagar";
        }
        valorDas = analise.valor_das || null;
      }

      dasPorMes.push({
        mes: nomesMeses[mes - 1],
        ano: anoInt,
        data_pagamento: dataPagamento,
        valor_das: valorDas,
        status
      });
    }

    // Verificar se há pelo menos um DAS pago ou a pagar
    const temDasRelevante = dasPorMes.some(das => das.status !== "importacao_pendente");

    res.json({
      success: true,
      data: dasPorMes,
      tem_das: temDasRelevante,
      total_meses: dasPorMes.length
    });

  } catch (err) {
    console.error('Erro ao buscar DAS mensais:', err);
    res.status(500).json({ 
      error: "Erro interno do servidor ao buscar DAS mensais",
      details: err.message 
    });
  }
});

// GET /simples-nacional/folhas-mensais - Buscar dados de folhas de salários mensais
router.get("/folhas-mensais", verifyToken, async (req, res) => {
  try {
    const { cnpj_emitente, ano, clientes_id, company_id } = req.query;

    if (!ano) {
      return res.status(400).json({ error: "Ano é obrigatório" });
    }

    const anoInt = Number.parseInt(ano, 10);
    if (Number.isNaN(anoInt)) {
      return res.status(400).json({ error: "Ano inválido" });
    }

    const companyIdsUser = Array.isArray(req.user.all_company_ids) ? req.user.all_company_ids : [];
    if (!companyIdsUser.length) {
      return res.status(403).json({ error: "Usuário não possui empresas associadas" });
    }

    let clienteRow = null;

    if (clientes_id) {
      const clienteIdParsed = Number.parseInt(clientes_id, 10);
      if (Number.isNaN(clienteIdParsed)) {
        return res.status(400).json({ error: "clientes_id inválido" });
      }

      const [clienteRows] = await pool.query(
        `
          SELECT id, empresa_id
          FROM clientes
          WHERE id = ?
            AND regime_tributario = 'simples_nacional'
        `,
        [clienteIdParsed]
      );

      if (!clienteRows.length || !companyIdsUser.includes(clienteRows[0].empresa_id)) {
        return res.status(404).json({ error: "Cliente não encontrado" });
      }

      clienteRow = clienteRows[0];
    } else if (cnpj_emitente) {
      const cleanCnpj = sanitizeCnpj(cnpj_emitente);
      if (!cleanCnpj) {
        return res.status(400).json({ error: "CNPJ inválido" });
      }

      let companiesToFilter = [...companyIdsUser];
      if (company_id) {
        const companyIdParsed = Number.parseInt(company_id, 10);
        if (Number.isNaN(companyIdParsed) || !companyIdsUser.includes(companyIdParsed)) {
          return res.status(403).json({ error: "Acesso negado a esta empresa" });
        }
        companiesToFilter = [companyIdParsed];
      }

      const placeholders = companiesToFilter.map(() => "?").join(",");

      const [clienteRows] = await pool.query(
        `
          SELECT id, empresa_id
          FROM clientes
          WHERE REPLACE(REPLACE(REPLACE(cpf_cnpj, '.', ''), '-', ''), '/', '') = ?
            AND regime_tributario = 'simples_nacional'
            AND empresa_id IN (${placeholders})
          LIMIT 1
        `,
        [cleanCnpj, ...companiesToFilter]
      );

      if (!clienteRows.length) {
        return res.status(404).json({ error: "Cliente não encontrado" });
      }

      clienteRow = clienteRows[0];
    } else {
      return res.status(400).json({ error: "clientes_id ou cnpj_emitente é obrigatório" });
    }

    const [analisesRows] = await pool.query(
      `
        SELECT mes, ano, valor_folha
        FROM analises_simples_nacional
        WHERE cliente_id = ?
          AND ano = ?
        ORDER BY mes ASC
      `,
      [clienteRow.id, anoInt]
    );

    // Criar array com todos os 12 meses
    const nomesMeses = [
      "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
      "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
    ];

    const folhasPorMes = [];
    let valorTotal = 0;

    for (let mes = 1; mes <= 12; mes++) {
      const analise = analisesRows?.find((a) => a.mes === mes);
      const valorFolha = analise?.valor_folha ? parseFloat(analise.valor_folha) : 0;
      
      if (valorFolha > 0) {
        valorTotal += valorFolha;
      }

      folhasPorMes.push({
        mes: nomesMeses[mes - 1],
        valor: valorFolha
      });
    }

    // Verificar se há pelo menos uma folha com valor
    const temFolhas = valorTotal > 0;

    res.json({
      success: true,
      data: folhasPorMes,
      tem_folhas: temFolhas,
      valor_total: valorTotal,
      total_meses: folhasPorMes.length
    });

  } catch (err) {
    console.error('Erro ao buscar folhas mensais:', err);
    res.status(500).json({ 
      error: "Erro interno do servidor ao buscar folhas mensais",
      details: err.message 
    });
  }
});

// GET /simples-nacional/folhas-anteriores - Buscar dados da coluna jsonb folha_de_salarios_anteriores filtrados por ano
router.get("/folhas-anteriores", verifyToken, async (req, res) => {
  try {
    const { cnpj_emitente, ano, clientes_id, company_id } = req.query;

    if (!ano) {
      return res.status(400).json({ error: "Ano é obrigatório" });
    }

    const anoStr = String(ano);
    const anoInt = Number.parseInt(anoStr, 10);
    if (Number.isNaN(anoInt)) {
      return res.status(400).json({ error: "Ano inválido" });
    }

    const companyIdsUser = Array.isArray(req.user.all_company_ids) ? req.user.all_company_ids : [];
    if (!companyIdsUser.length) {
      return res.status(403).json({ error: "Usuário não possui empresas associadas" });
    }

    let clienteRow = null;

    if (clientes_id) {
      const clienteIdParsed = Number.parseInt(clientes_id, 10);
      if (Number.isNaN(clienteIdParsed)) {
        return res.status(400).json({ error: "clientes_id inválido" });
      }

      const [clienteRows] = await pool.query(
        `
          SELECT id, empresa_id
          FROM clientes
          WHERE id = ?
            AND regime_tributario = 'simples_nacional'
        `,
        [clienteIdParsed]
      );

      if (!clienteRows.length || !companyIdsUser.includes(clienteRows[0].empresa_id)) {
        return res.status(404).json({ error: "Cliente não encontrado" });
      }

      clienteRow = clienteRows[0];
    } else if (cnpj_emitente) {
      const cleanCnpj = sanitizeCnpj(cnpj_emitente);
      if (!cleanCnpj) {
        return res.status(400).json({ error: "CNPJ inválido" });
      }

      let companiesToFilter = [...companyIdsUser];
      if (company_id) {
        const companyIdParsed = Number.parseInt(company_id, 10);
        if (Number.isNaN(companyIdParsed) || !companyIdsUser.includes(companyIdParsed)) {
          return res.status(403).json({ error: "Acesso negado a esta empresa" });
        }
        companiesToFilter = [companyIdParsed];
      }

      const placeholders = companiesToFilter.map(() => "?").join(",");

      const [clienteRows] = await pool.query(
        `
          SELECT id, empresa_id
          FROM clientes
          WHERE REPLACE(REPLACE(REPLACE(cpf_cnpj, '.', ''), '-', ''), '/', '') = ?
            AND regime_tributario = 'simples_nacional'
            AND empresa_id IN (${placeholders})
          LIMIT 1
        `,
        [cleanCnpj, ...companiesToFilter]
      );

      if (!clienteRows.length) {
        return res.status(404).json({ error: "Cliente não encontrado" });
      }

      clienteRow = clienteRows[0];
    } else {
      return res.status(400).json({ error: "cnpj_emitente ou clientes_id é obrigatório" });
    }

    const [analisesRows] = await pool.query(
      `
        SELECT
          id,
          periodo_documento,
          data_extracao,
          folha_de_salarios_anteriores,
          cnpj,
          cliente_id
        FROM analises_simples_nacional
        WHERE cliente_id = ?
          AND folha_de_salarios_anteriores IS NOT NULL
      `,
      [clienteRow.id]
    );

    let analises = [...(analisesRows || [])];

    if (!analises.length && cnpj_emitente) {
      const cleanCnpj = sanitizeCnpj(cnpj_emitente);
      if (cleanCnpj) {
        const [analisesByCnpj] = await pool.query(
          `
            SELECT
              a.id,
              a.periodo_documento,
              a.data_extracao,
              a.folha_de_salarios_anteriores,
              a.cnpj,
              a.cliente_id
            FROM analises_simples_nacional AS a
            INNER JOIN clientes AS c ON c.id = a.cliente_id
            WHERE REPLACE(REPLACE(REPLACE(a.cnpj, '.', ''), '-', ''), '/', '') = ?
              AND c.empresa_id IN (${companiesToFilter.map(() => "?").join(",")})
              AND c.regime_tributario = 'simples_nacional'
              AND a.folha_de_salarios_anteriores IS NOT NULL
          `,
          [cleanCnpj, ...companiesToFilter]
        );

        if (analisesByCnpj?.length) {
          analises = analisesByCnpj;
        }
      }
    }

    const porCompetencia = {};

    // Achatar e filtrar por ano, mantendo o registro mais recente por competência
    for (const analise of analises) {
      let itens = [];
      try {
        if (Array.isArray(analise.folha_de_salarios_anteriores)) {
          itens = analise.folha_de_salarios_anteriores;
        } else if (
          typeof analise.folha_de_salarios_anteriores === 'string' &&
          analise.folha_de_salarios_anteriores.trim() !== ''
        ) {
          // Alguns drivers podem retornar jsonb como string
          const parsed = JSON.parse(analise.folha_de_salarios_anteriores);
          if (Array.isArray(parsed)) itens = parsed;
        } else if (
          analise.folha_de_salarios_anteriores &&
          typeof analise.folha_de_salarios_anteriores === 'object'
        ) {
          // Caso venha como objeto com a lista em uma chave comum
          const maybeArray = analise.folha_de_salarios_anteriores.itens || analise.folha_de_salarios_anteriores.data;
          if (Array.isArray(maybeArray)) itens = maybeArray;
        }
      } catch (e) {
        console.warn('[folhas-anteriores] Falha ao parsear jsonb:', e);
      }

      for (const item of itens) {
        if (!item || !item.competencia || typeof item.valor === 'undefined') continue;
        // item.competencia no formato MM/AAAA
        const comp = String(item.competencia).trim();
        if (!/\d{2}\/\d{4}/.test(comp)) continue;
        const [, anoItem] = comp.split('/');
        if (anoItem !== anoStr) continue;

        const existente = porCompetencia[comp];
        const currentTs = new Date(analise.data_extracao || analise.periodo_documento || '1970-01-01').getTime();
        if (!existente || currentTs > existente._ts) {
          porCompetencia[comp] = {
            competencia: comp,
            valor: typeof item.valor === 'number' ? item.valor : parseFloat(String(item.valor).replace(/\./g, '').replace(',', '.')) || 0,
            _ts: currentTs
          };
        }
      }
    }

    // Transformar em array e ordenar por mês
    const resultados = Object.values(porCompetencia)
      .map((r) => ({ competencia: r.competencia, valor: r.valor }))
      .sort((a, b) => {
        const [ma, ya] = a.competencia.split('/').map(Number);
        const [mb, yb] = b.competencia.split('/').map(Number);
        if (ya !== yb) return ya - yb;
        return ma - mb;
      });

    return res.json({ success: true, ano: parseInt(anoStr, 10), data: resultados, total_registros: resultados.length });
  } catch (err) {
    console.error('Erro ao buscar folhas anteriores:', err);
    res.status(500).json({ error: "Erro interno do servidor ao buscar folhas anteriores", details: err.message });
  }
});

// GET /simples-nacional/folhas-anteriores-por-mes?cnpj_emitente=...&ano=2025
// Retorna para cada mês do ano selecionado os itens do jsonb salvos no extrato daquele mês
router.get("/folhas-anteriores-por-mes", verifyToken, async (req, res) => {
  try {
    const { cnpj_emitente, ano, clientes_id, company_id } = req.query;
    if (!ano) return res.status(400).json({ error: 'Ano é obrigatório' });

    const anoInt = Number.parseInt(ano, 10);
    if (Number.isNaN(anoInt)) {
      return res.status(400).json({ error: "Ano inválido" });
    }

    const companyIdsUser = Array.isArray(req.user.all_company_ids) ? req.user.all_company_ids : [];
    if (!companyIdsUser.length) {
      return res.status(403).json({ error: "Usuário não possui empresas associadas" });
    }

    let clienteId = clientes_id || null;
    let companiesToFilter = [...companyIdsUser];

    if (clienteId) {
      const clienteIdParsed = Number.parseInt(clienteId, 10);
      if (Number.isNaN(clienteIdParsed)) {
        return res.status(400).json({ error: "clientes_id inválido" });
      }

      const [clienteRows] = await pool.query(
        `
          SELECT id, empresa_id
          FROM clientes
          WHERE id = ?
            AND regime_tributario = 'simples_nacional'
        `,
        [clienteIdParsed]
      );

      if (!clienteRows.length || !companyIdsUser.includes(clienteRows[0].empresa_id)) {
        return res.status(404).json({ error: "Cliente não encontrado" });
      }

      clienteId = clienteRows[0].id;
      companiesToFilter = [clienteRows[0].empresa_id];
    } else {
      if (!cnpj_emitente) return res.status(400).json({ error: 'cnpj_emitente ou clientes_id é obrigatório' });
      const cleanCnpj = sanitizeCnpj(cnpj_emitente);
      if (!cleanCnpj) {
        return res.status(400).json({ error: "CNPJ inválido" });
      }

      if (company_id) {
        const companyIdParsed = Number.parseInt(company_id, 10);
        if (Number.isNaN(companyIdParsed) || !companyIdsUser.includes(companyIdParsed)) {
          return res.status(403).json({ error: "Acesso negado a esta empresa" });
        }
        companiesToFilter = [companyIdParsed];
      }

      const [clienteRows] = await pool.query(
        `
          SELECT id, empresa_id
          FROM clientes
          WHERE REPLACE(REPLACE(REPLACE(cpf_cnpj, '.', ''), '-', ''), '/', '') = ?
            AND regime_tributario = 'simples_nacional'
            AND empresa_id IN (${companiesToFilter.map(() => "?").join(",")})
          LIMIT 1
        `,
        [cleanCnpj, ...companiesToFilter]
      );

      if (!clienteRows.length) {
        return res.status(404).json({ error: "Cliente não encontrado" });
      }

      clienteId = clienteRows[0].id;
      companiesToFilter = [clienteRows[0].empresa_id];
    }

    const [analisesRows] = await pool.query(
      `
        SELECT mes, ano, folha_de_salarios_anteriores, periodo_documento
        FROM analises_simples_nacional
        WHERE cliente_id = ?
          AND ano = ?
        ORDER BY mes ASC
      `,
      [clienteId, anoInt]
    );

    let listaAnalises = analisesRows || [];

    if (!listaAnalises.length) {
      const [analisesPeriodo] = await pool.query(
        `
          SELECT mes, ano, periodo_documento, folha_de_salarios_anteriores
          FROM analises_simples_nacional
          WHERE cliente_id = ?
            AND periodo_documento LIKE ?
          ORDER BY mes ASC
        `,
        [clienteId, `%/${anoInt}%`]
      );

      if (analisesPeriodo?.length) {
        listaAnalises = analisesPeriodo;
      }
    }

    // Mapa mês -> itens do jsonb do extrato daquele mês
    const meses = Array.from({ length: 12 }, (_, idx) => idx + 1);
    const resultado = meses.map((m) => ({ mes: m, itens: [] }));

    for (const a of listaAnalises || []) {
      let itens = [];
      try {
        if (Array.isArray(a.folha_de_salarios_anteriores)) itens = a.folha_de_salarios_anteriores;
        else if (typeof a.folha_de_salarios_anteriores === 'string' && a.folha_de_salarios_anteriores.trim() !== '') {
          const parsed = JSON.parse(a.folha_de_salarios_anteriores);
          if (Array.isArray(parsed)) itens = parsed;
        } else if (a.folha_de_salarios_anteriores && typeof a.folha_de_salarios_anteriores === 'object') {
          const maybeArray = a.folha_de_salarios_anteriores.itens || a.folha_de_salarios_anteriores.data;
          if (Array.isArray(maybeArray)) itens = maybeArray;
        }
      } catch {}

      const idx = (a.mes || 1) - 1;
      if (idx >= 0 && idx < 12) {
        // Não filtra por ano da competência aqui; mostra o json do extrato daquele mês
        resultado[idx].itens = itens.map((i) => ({
          competencia: String(i.competencia || ''),
          valor: typeof i.valor === 'number' ? i.valor : parseFloat(String(i.valor || '0').replace(/\./g, '').replace(',', '.')) || 0
        }));
      }
    }

    res.json({ success: true, ano: parseInt(ano, 10), data: resultado });
  } catch (err) {
    console.error('Erro ao buscar folhas anteriores por mês:', err);
    res.status(500).json({ error: 'Erro interno do servidor', details: err.message });
  }
});

// GET /simples-nacional/pulos-detectados - Detectar pulos nas sequências de notas fiscais
router.get("/pulos-detectados", verifyToken, async (req, res) => {
  try {
    const { cnpj_emitente, ano, company_id } = req.query;

    if (!cnpj_emitente) {
      return res.status(400).json({ error: "CNPJ emitente é obrigatório" });
    }

    if (!ano) {
      return res.status(400).json({ error: "Ano é obrigatório" });
    }

    const anoInt = Number.parseInt(ano, 10);
    if (Number.isNaN(anoInt)) {
      return res.status(400).json({ error: "Ano inválido" });
    }

    const cleanCnpj = sanitizeCnpj(cnpj_emitente);
    if (!cleanCnpj) {
      return res.status(400).json({ error: "CNPJ inválido" });
    }

    const companyIdsUser = Array.isArray(req.user.all_company_ids) ? req.user.all_company_ids : [];
    if (!companyIdsUser.length) {
      return res.status(403).json({ error: "Usuário não possui empresas associadas" });
    }

    let companiesToFilter = [...companyIdsUser];
    if (company_id) {
      const companyIdParsed = Number.parseInt(company_id, 10);
      if (Number.isNaN(companyIdParsed) || !companyIdsUser.includes(companyIdParsed)) {
        return res.status(403).json({ error: "Acesso negado a esta empresa" });
      }
      companiesToFilter = [companyIdParsed];
    }

    const [clientesRows] = await pool.query(
      `
        SELECT id
        FROM clientes
        WHERE REPLACE(REPLACE(REPLACE(cpf_cnpj, '.', ''), '-', ''), '/', '') = ?
          AND empresa_id IN (${companiesToFilter.map(() => "?").join(",")})
      `,
      [cleanCnpj, ...companiesToFilter]
    );

    if (!clientesRows.length) {
      return res.json({
        success: true,
        data: [],
        total_pulos: 0,
      });
    }

    const clienteIds = clientesRows.map((row) => row.id);
    const clientePlaceholders = clienteIds.map(() => "?").join(",");

    const [notas] = await pool.query(
      `
        SELECT numero_nfe, serie, data_emissao, cnpj_emitente
        FROM notas_fiscais
        WHERE cliente_id IN (${clientePlaceholders})
          AND REPLACE(REPLACE(REPLACE(cnpj_emitente, '.', ''), '-', ''), '/', '') = ?
          AND data_emissao BETWEEN ? AND ?
        ORDER BY CAST(numero_nfe AS UNSIGNED)
      `,
      [...clienteIds, cleanCnpj, `${anoInt}-01-01`, `${anoInt}-12-31`]
    );

    if (!notas || notas.length === 0) {
      return res.json({
        success: true,
        data: [],
        total_pulos: 0
      });
    }

    // Agrupar notas por série
    const notasPorSerie = {};
    notas.forEach(nota => {
      const serie = nota.serie?.toString() || "1";
      if (!notasPorSerie[serie]) {
        notasPorSerie[serie] = [];
      }
      const numero = typeof nota.numero_nfe === "string" 
        ? parseInt(nota.numero_nfe, 10) 
        : nota.numero_nfe;
      notasPorSerie[serie].push({
        numero: numero,
        data: nota.data_emissao
      });
    });

    const pulosEncontrados = [];

    // Verificar pulos em cada série
    Object.entries(notasPorSerie).forEach(([serie, notasSerie]) => {
      if (notasSerie.length < 2) return;

      // Ordenar por número da nota
      notasSerie.sort((a, b) => a.numero - b.numero);

      const pulos = [];

      // Verificar pulos na sequência
      for (let i = 0; i < notasSerie.length - 1; i++) {
        const numeroAtual = notasSerie[i].numero;
        const numeroProximo = notasSerie[i + 1].numero;

        // Se há um gap maior que 1, há um pulo (limitado a 50 para evitar falsos positivos)
        if (numeroProximo - numeroAtual > 1 && numeroProximo - numeroAtual <= 50) {
          for (let j = numeroAtual + 1; j < numeroProximo; j++) {
            pulos.push(j);
          }
        }
      }

      if (pulos.length > 0) {
        // Calcular o mês esperado baseado na sequência de notas
        const datasNotas = notasSerie.map(n => new Date(n.data));
        const mediaDatas = new Date(
          datasNotas.reduce((sum, date) => sum + date.getTime(), 0) / datasNotas.length
        );

        const mesesNotas = datasNotas.map(d => d.getMonth());
        const mesMaisFrequente = mesesNotas.reduce((acc, mes) => {
          acc[mes] = (acc[mes] || 0) + 1;
          return acc;
        }, {});

        const mesComMaisNotas = Object.entries(mesMaisFrequente).sort(
          ([, a], [, b]) => b - a
        )[0][0];

        const nomesMeses = [
          "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
          "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
        ];

        pulosEncontrados.push({
          cnpj: cnpj_emitente,
          serie: serie,
          notasPuladas: pulos,
          mesEsperado: nomesMeses[parseInt(mesComMaisNotas)],
          anoEsperado: parseInt(ano)
        });
      }
    });

    const totalPulos = pulosEncontrados.reduce((sum, pulo) => sum + pulo.notasPuladas.length, 0);

    res.json({
      success: true,
      data: pulosEncontrados,
      total_pulos: totalPulos
    });

  } catch (err) {
    console.error('Erro ao detectar pulos:', err);
    res.status(500).json({ 
      error: "Erro interno do servidor ao detectar pulos",
      details: err.message 
    });
  }
});

// GET /simples-nacional/:id - Buscar análise específica
router.get("/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    const analiseId = Number.parseInt(id, 10);
    if (Number.isNaN(analiseId)) {
      return res.status(400).json({ error: "ID inválido" });
    }

    const companyIdsUser = Array.isArray(req.user.all_company_ids) ? req.user.all_company_ids : [];
    if (!companyIdsUser.length) {
      return res.status(403).json({ error: "Usuário não possui empresas associadas" });
    }

    const companyPlaceholders = companyIdsUser.map(() => "?").join(",");

    const [rows] = await pool.query(
      `
        SELECT
          asn.*,
          c.id AS cliente_id,
          c.cpf_cnpj AS cliente_cnpj,
          c.estado AS cliente_uf,
          COALESCE(c.nome_fantasia, c.razao_social, c.apelido) AS cliente_nome,
          c.empresa_id AS cliente_company_id
        FROM analises_simples_nacional AS asn
        INNER JOIN clientes AS c ON c.id = asn.cliente_id
        WHERE asn.id = ?
          AND c.empresa_id IN (${companyPlaceholders})
        LIMIT 1
      `,
      [analiseId, ...companyIdsUser]
    );

    if (!rows.length) {
      return res.status(404).json({ error: "Análise não encontrada" });
    }

    const row = rows[0];

    res.json({
      id: row.id,
      cliente_id: row.cliente_id,
      clientes_id: row.cliente_id,
      cnpj: row.cnpj,
      arquivo_nome: row.arquivo_nome,
      tipo: row.tipo,
      mes: row.mes,
      ano: row.ano,
      resumo: parseJSONSafely(row.resumo),
      data_extracao: row.data_extracao,
      resultado_api: parseJSONSafely(row.resultado_api),
      fator_r_status: row.fator_r_status,
      atividade_principal: row.atividade_principal,
      canes: parseJSONSafely(row.canes),
      icms_porcentagem: row.icms_porcentagem,
      pis_cofins_porcentagem: row.pis_cofins_porcentagem,
      receita_total: row.receita_total,
      icms_total: row.icms_total,
      pis_total: row.pis_total,
      cofins_total: row.cofins_total,
      periodo_documento: row.periodo_documento,
      valor_das: row.valor_das,
      anexos_simples: parseJSONSafely(row.anexos_simples),
      valor_folha: row.valor_folha,
      folha_de_salarios_anteriores: parseJSONSafely(row.folha_de_salarios_anteriores),
      data_pag: row.data_pag,
      data_pagamento: row.data_pag,
      criado_em: row.criado_em,
      atualizado_em: row.atualizado_em,
      criado_por: row.criado_por,
      atualizado_por: row.atualizado_por,
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
    console.error('Erro ao buscar análise:', err);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

// DELETE /simples-nacional/:id - Deletar análise
router.delete("/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    const analiseId = Number.parseInt(id, 10);
    if (Number.isNaN(analiseId)) {
      return res.status(400).json({ error: "ID inválido" });
    }

    const companyIdsUser = Array.isArray(req.user.all_company_ids) ? req.user.all_company_ids : [];
    if (!companyIdsUser.length) {
      return res.status(403).json({ error: "Usuário não possui empresas associadas" });
    }

    const placeholders = companyIdsUser.map(() => "?").join(",");

    const [rows] = await pool.query(
      `
        SELECT asn.id
        FROM analises_simples_nacional AS asn
        INNER JOIN clientes AS c ON c.id = asn.cliente_id
        WHERE asn.id = ?
          AND c.empresa_id IN (${placeholders})
        LIMIT 1
      `,
      [analiseId, ...companyIdsUser]
    );

    if (!rows.length) {
      return res.status(404).json({ error: "Análise não encontrada" });
    }

    const [deleteResult] = await pool.query(
      `
        DELETE FROM analises_simples_nacional
        WHERE id = ?
      `,
      [analiseId]
    );

    if (deleteResult.affectedRows === 0) {
      return res.status(500).json({ error: "Falha ao deletar análise" });
    }

    res.json({ message: "Análise deletada com sucesso" });
  } catch (err) {
    console.error('Erro ao deletar análise:', err);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

module.exports = router;
