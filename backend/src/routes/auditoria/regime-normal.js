const express = require("express");
const router = express.Router();
const pool = require("../../config/database");
const verifyToken = require("../../middlewares/auth");
const multer = require('multer');
const upload = multer();

// ===== ROTAS PARA REGIME NORMAL =====

// POST /regime-normal/upload - Upload de análise do Regime Normal
router.post("/upload", verifyToken, upload.single('file'), async (req, res) => {
  try {
    const {
      cnpj,
      arquivo_nome,
      tipo,
      mes,
      ano,
      empresa_id,
      nome // opcional
    } = req.body;

    let resumo = {};
    try {
      resumo = JSON.parse(req.body.resumo || '{}');
    } catch {
      resumo = {};
    }

    // Validação obrigatória
    if (!cnpj || !arquivo_nome || !tipo || !mes || !ano || !empresa_id) {
      return res.status(400).json({ error: 'Campos obrigatórios: cnpj, arquivo_nome, tipo, mes, ano, resumo, empresa_id' });
    }

    // --- Buscar ou criar cliente ---
    const cleanCnpj = cnpj.replace(/\D/g, '');
    let clienteId;
    const [rows] = await pool.query(
      'SELECT id FROM clientes WHERE cpf_cnpj = ? AND empresa_id = ? LIMIT 1',
      [cleanCnpj, empresa_id]
    );
    if (rows.length) {
      clienteId = rows[0].id;
    } else {
      // Cria cliente se não existe
      const [resultInsert] = await pool.query(
        'INSERT INTO clientes (cpf_cnpj, empresa_id, nome, uf, regime_tributario) VALUES (?, ?, ?, ?, ?)',
        [cleanCnpj, empresa_id, nome || 'Cliente', 'RJ', 'regime_normal']
      );
      clienteId = resultInsert.insertId;
    }

    // --- Insere na analises_regime_normal ---
    console.log('[BACKEND DEBUG] PREPARANDO PARA INSERIR', {clienteId, empresa_id, resumo});
    const [insertResult] = await pool.query(
      `INSERT INTO analises_regime_normal
      (cliente_id, cnpj, arquivo_nome, tipo, mes, ano, resumo, criado_em)
      VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        clienteId,
        cleanCnpj,
        arquivo_nome,
        tipo,
        mes,
        ano,
        JSON.stringify(resumo)
      ]
    );
    return res.json({ success: true, id: insertResult.insertId });
  } catch (error) {
    console.error('Erro no upload de regime normal:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// GET /regime-normal - Listar análises do Regime Normal
router.get("/", verifyToken, async (req, res) => {
  try {
    const {
      clientes_id,
      cnpj,
      ano,
      mes,
      tipo,
      page = 1,
      limit = 50,
      sort_by = "created_at",
      sort_order = "desc",
    } = req.query;

    const pageNumber = Number.parseInt(page, 10) || 1;
    const limitNumber = Number.parseInt(limit, 10) || 50;
    const offset = (pageNumber - 1) * limitNumber;

    const clienteId = clientes_id ? Number.parseInt(clientes_id, 10) : null;
    const anoInt = ano ? Number.parseInt(ano, 10) : null;
    const mesInt = mes ? Number.parseInt(mes, 10) : null;
    const cleanCnpj = cnpj ? cnpj.replace(/\D/g, "") : null;

    const companyIds = Array.isArray(req.user.all_company_ids) ? req.user.all_company_ids : [];

    if (!companyIds.length) {
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

    const filtros = [`c.empresa_id IN (${companyIds.map(() => "?").join(",")})`];
    const params = [...companyIds];

    if (clienteId) {
      filtros.push("arn.cliente_id = ?");
      params.push(clienteId);
    }

    if (cleanCnpj) {
      filtros.push("arn.cnpj = ?");
      params.push(cleanCnpj);
    }

    if (anoInt) {
      filtros.push("arn.ano = ?");
      params.push(anoInt);
    }

    if (mesInt) {
      filtros.push("arn.mes = ?");
      params.push(mesInt);
    }

    if (tipo) {
      filtros.push("arn.tipo = ?");
      params.push(tipo);
    }

    const whereClause = filtros.length ? `WHERE ${filtros.join(" AND ")}` : "";

    const camposOrdenacao = {
      cnpj: "arn.cnpj",
      created_at: "arn.criado_em",
      updated_at: "arn.atualizado_em",
      mes: "arn.mes",
      ano: "arn.ano",
      tipo: "arn.tipo",
    };
    const sortColumn = camposOrdenacao[sort_by] || "arn.criado_em";
    const sortDirection = sort_order === "asc" ? "ASC" : "DESC";

    const consulta = `
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
        ${whereClause}
      ORDER BY ${sortColumn} ${sortDirection}
        LIMIT ?
        OFFSET ?
    `;

    const [rows] = await pool.query(consulta, [...params, limitNumber, offset]);

    const [[countRow]] = await pool.query(
      `
        SELECT COUNT(*) AS total
        FROM analises_regime_normal AS arn
        INNER JOIN clientes AS c ON c.id = arn.cliente_id
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
      resumo: row.resumo,
      created_at: row.created_at,
      updated_at: row.updated_at,
      cliente: row.cliente_id
        ? {
            id: row.cliente_id,
            nome: row.cliente_nome,
            cnpj: row.cliente_cnpj,
            uf: row.cliente_uf,
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
    console.error("Erro ao buscar análises do Regime Normal:", err);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

// GET /regime-normal/clientes - Listar clientes do Regime Normal
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

    const companyIdParam = company_id ? Number.parseInt(company_id, 10) : null;
    const cleanCnpj = cnpj ? cnpj.replace(/\D/g, "") : null;
    const ufParam = uf ? uf.toUpperCase() : null;
    const nomeParam = nome ? nome.trim() : null;

    const companyIdsUser = Array.isArray(req.user.all_company_ids) ? req.user.all_company_ids : [];

    const filtros = ["c.regime_tributario = 'regime_normal'"];
    const params = [];

    if (companyIdParam) {
      filtros.push("c.empresa_id = ?");
      params.push(companyIdParam);
    } else {
      if (!companyIdsUser.length) {
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
      filtros.push(`c.empresa_id IN (${companyIdsUser.map(() => "?").join(",")})`);
      params.push(...companyIdsUser);
      }

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
    console.error("Erro ao buscar clientes do Regime Normal:", err);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

// GET /regime-normal/status-obrigacoes - Buscar status das obrigações por cliente e ano
router.get("/status-obrigacoes", verifyToken, async (req, res) => {
  try {
    const { cnpj, clientes_id, ano, empresa_id } = req.query;
    if (!clientes_id || !empresa_id) return res.status(400).json({ error: 'clientes_id e empresa_id são obrigatórios'});
    const [clienteRows] = await pool.query('SELECT * FROM clientes WHERE id = ? AND empresa_id = ?', [clientes_id, empresa_id]);
    if (!clienteRows.length) return res.status(404).json({ error: 'Cliente não encontrado' });

    const anoInt = Number.parseInt(ano, 10);
    if (Number.isNaN(anoInt)) {
      return res.status(400).json({ error: "Ano inválido" });
    }

    const [analisesRows] = await pool.query(
      `
        SELECT
          arn.mes,
          arn.ano,
          arn.tipo,
          arn.arquivo_nome,
          arn.resumo
        FROM analises_regime_normal AS arn
        INNER JOIN clientes AS c ON c.id = arn.cliente_id
        WHERE arn.cliente_id = ?
          AND arn.ano = ?
          AND c.empresa_id = ?
        ORDER BY arn.mes ASC
      `,
      [clienteRows[0].id, anoInt, clienteRows[0].empresa_id]
    );

    // Criar array com todos os 12 meses
    const nomesMeses = [
      "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
      "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
    ];

    const statusPorMes = [];

    for (let mes = 1; mes <= 12; mes++) {
      const analisesDoMes = analisesRows.filter((a) => a.mes === mes);

      // Verificar quais tipos de análise existem para este mês
      const tipos = analisesDoMes.map(a => a.tipo);
      
      statusPorMes.push({
        mes: nomesMeses[mes - 1],
        mesNumero: mes,
        ano: anoInt,
        tipos: tipos,
        analises: analisesDoMes
      });
    }

    res.json({
      success: true,
      data: statusPorMes,
      total_analises: analisesRows.length,
      total_meses: statusPorMes.length
    });

  } catch (err) {
    console.error('Erro ao buscar status das obrigações:', err);
    res.status(500).json({
      error: "Erro interno do servidor ao buscar status das obrigações",
      details: err.message 
    });
  }
});

// GET /regime-normal/analises-mensais - Buscar análises mensais por cliente e ano
router.get("/analises-mensais", verifyToken, async (req, res) => {
  try {
    const { cnpj, ano } = req.query;

    if (!cnpj) {
      return res.status(400).json({ error: "CNPJ é obrigatório" });
    }

    if (!ano) {
      return res.status(400).json({ error: "Ano é obrigatório" });
    }

    const companyIds = Array.isArray(req.user.all_company_ids) ? req.user.all_company_ids : [];

    if (!companyIds.length) {
      return res.status(404).json({ error: "Cliente não encontrado" });
    }

    const cleanCnpj = cnpj.replace(/\D/g, "");
    if (!cleanCnpj) {
      return res.status(400).json({ error: "CNPJ inválido" });
    }

    const anoInt = Number.parseInt(ano, 10);
    if (Number.isNaN(anoInt)) {
      return res.status(400).json({ error: "Ano inválido" });
    }

    const [clienteRows] = await pool.query(
      `
        SELECT id, empresa_id
        FROM clientes
        WHERE REPLACE(REPLACE(REPLACE(cpf_cnpj, '.', ''), '-', ''), '/', '') = ?
          AND regime_tributario = 'regime_normal'
          AND empresa_id IN (${companyIds.map(() => "?").join(",")})
        LIMIT 1
      `,
      [cleanCnpj, ...companyIds]
    );

    if (!clienteRows.length) {
      return res.status(404).json({ error: "Cliente não encontrado" });
    }

    const cliente = clienteRows[0];

    const [analisesRows] = await pool.query(
      `
        SELECT
          arn.mes,
          arn.ano,
          arn.tipo,
          arn.arquivo_nome,
          arn.resumo
        FROM analises_regime_normal AS arn
        INNER JOIN clientes AS c ON c.id = arn.cliente_id
        WHERE arn.cliente_id = ?
          AND arn.ano = ?
          AND c.empresa_id = ?
        ORDER BY arn.mes ASC
      `,
      [cliente.id, anoInt, cliente.empresa_id]
    );

    // Criar array com todos os 12 meses
    const nomesMeses = [
      "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
      "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
    ];

    const analisesPorMes = [];

    for (let mes = 1; mes <= 12; mes++) {
      const analise = analisesRows.find(a => a.mes === mes);
      
      let status = "sem_analise";
      let tipoAnalise = null;
      let arquivoNome = null;
      let resumo = null;

      if (analise) {
        status = "analisado";
        tipoAnalise = analise.tipo;
        arquivoNome = analise.arquivo_nome;
        resumo = analise.resumo;
      }

      analisesPorMes.push({
        mes: nomesMeses[mes - 1],
        mesNumero: mes,
        ano: anoInt,
        status,
        tipo: tipoAnalise,
        arquivo_nome: arquivoNome,
        resumo
      });
    }

    // Verificar se há pelo menos uma análise
    const temAnalises = analisesPorMes.some(item => item.status === "analisado");

    res.json({
      success: true,
      data: analisesPorMes,
      tem_analises: temAnalises,
      total_analises: analisesRows.length,
      total_meses: analisesPorMes.length
    });

  } catch (err) {
    console.error('Erro ao buscar análises mensais:', err);
    res.status(500).json({
      error: "Erro interno do servidor ao buscar análises mensais",
      details: err.message 
    });
  }
});

// GET /regime-normal/:id - Buscar análise específica
router.get("/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    const analiseId = Number.parseInt(id, 10);
    if (Number.isNaN(analiseId)) {
      return res.status(400).json({ error: "ID inválido" });
    }

    const companyIds = Array.isArray(req.user.all_company_ids) ? req.user.all_company_ids : [];

    if (!companyIds.length) {
      return res.status(404).json({ error: "Análise não encontrada" });
    }

    const [rows] = await pool.query(
      `
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
        WHERE arn.id = ?
          AND c.empresa_id IN (${companyIds.map(() => "?").join(",")})
        LIMIT 1
      `,
      [analiseId, ...companyIds]
    );

    if (!rows.length) {
      return res.status(404).json({ error: "Análise não encontrada" });
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
      cliente: row.cliente_id
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

// PUT /regime-normal/:id - Atualizar análise
router.put("/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { 
          arquivo_nome,
          tipo,
          mes,
          ano,
      resumo
    } = req.body;

    const analiseId = Number.parseInt(id, 10);
    if (Number.isNaN(analiseId)) {
      return res.status(400).json({ error: "ID inválido" });
    }

    const companyIds = Array.isArray(req.user.all_company_ids) ? req.user.all_company_ids : [];

    const [existentes] = await pool.query(
      `
        SELECT
          arn.id,
          arn.cliente_id,
          c.empresa_id
        FROM analises_regime_normal AS arn
        INNER JOIN clientes AS c ON c.id = arn.cliente_id
        WHERE arn.id = ?
      `,
      [analiseId]
    );

    if (!existentes.length || !companyIds.includes(existentes[0].empresa_id)) {
      return res.status(404).json({ error: "Análise não encontrada" });
    }

    // Preparar dados para atualização
    const updateData = {};
    if (arquivo_nome !== undefined) updateData.arquivo_nome = arquivo_nome;
    if (tipo !== undefined) updateData.tipo = tipo;
    if (mes !== undefined) {
      const mesNumero = parseInt(mes);
      if (isNaN(mesNumero) || mesNumero < 1 || mesNumero > 12) {
        return res.status(400).json({ error: "Mês deve ser um número entre 1 e 12" });
      }
      updateData.mes = mesNumero;
    }
    if (ano !== undefined) {
      const anoNumero = parseInt(ano);
      if (isNaN(anoNumero) || anoNumero < 1900 || anoNumero > 2100) {
        return res.status(400).json({ error: "Ano deve ser um número válido entre 1900 e 2100" });
      }
      updateData.ano = anoNumero;
    }
    if (resumo !== undefined) updateData.resumo = resumo;
    
    if (!Object.keys(updateData).length) {
      return res.status(400).json({ error: "Nenhum campo válido para atualizar" });
  }

    const campos = [];
    const params = [];
    Object.entries(updateData).forEach(([campo, valor]) => {
      campos.push(`${campo} = ?`);
      params.push(valor);
    });
    campos.push("atualizado_por = ?");
    params.push(req.user.userId);
    params.push(analiseId);

    await pool.query(
        `
        UPDATE analises_regime_normal
        SET ${campos.join(", ")}
          WHERE id = ?
      `,
      params
    );

    const [atualizado] = await pool.query(
      `
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
        WHERE arn.id = ?
        LIMIT 1
      `,
      [analiseId]
    );

    const row = atualizado[0];

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
      cliente: row.cliente_id
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
    console.error('Erro ao atualizar análise:', err);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

// DELETE /regime-normal/:id - Deletar análise
router.delete("/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    const analiseId = Number.parseInt(id, 10);
    if (Number.isNaN(analiseId)) {
      return res.status(400).json({ error: "ID inválido" });
    }

    const companyIds = Array.isArray(req.user.all_company_ids) ? req.user.all_company_ids : [];
    if (!companyIds.length) {
      return res.status(404).json({ error: "Análise não encontrada" });
    }

    const [existentes] = await pool.query(
      `
        SELECT arn.id, c.empresa_id
        FROM analises_regime_normal AS arn
        INNER JOIN clientes AS c ON c.id = arn.cliente_id
        WHERE arn.id = ?
          AND c.empresa_id IN (${companyIds.map(() => "?").join(",")})
      `,
      [analiseId, ...companyIds]
    );

    if (!existentes.length) {
      return res.status(404).json({ error: "Análise não encontrada" });
    }

    await pool.query(
      `
        DELETE FROM analises_regime_normal
        WHERE id = ?
      `,
      [analiseId]
    );

    res.json({ message: "Análise deletada com sucesso" });
  } catch (err) {
    console.error('Erro ao deletar análise:', err);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

module.exports = router;
