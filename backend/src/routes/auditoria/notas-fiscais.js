const express = require("express");
const router = express.Router();
const pool = require("../../config/database");
const verifyToken = require("../../middlewares/auth");

const sanitizeCnpj = (value) => (value ? value.replace(/\D/g, "") : null);

function toMySQLDatetime(val) {
  if (!val) return null;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 19).replace('T', ' ');
}

const allowedColumns = [
  "id",
  "clientes_id",
  "cliente_id",
  "chave_nfe",
  "numero_nfe",
  "serie",
  "data_emissao",
  "data_saida_entrada",
  "data_importacao",
  "cnpj_emitente",
  "razao_social_emitente",
  "cnpj_destinatario",
  "razao_social_destinatario",
  "uf_origem",
  "uf_destino",
  "estado_origem",
  "estado_destino",
  "valor_total_nfe",
  "quantidade",
  "valor_unitario",
  "valor_total_item",
  "pis",
  "cofins",
  "icms",
  "valor_iss_ret",
  "iss_ret",
  "natureza_operacao",
  "modelo",
  "ncm_notas",
  "ncm",
  "cst_pis",
  "cst_cofins",
  "cst_icms",
  "cat_pis",
  "cat_cofins",
  "cat_icms",
  "cfop",
  "descricao_produto",
  "criado_em",
  "atualizado_em",
];

const columnAliasMap = {
  clientes_id: "cliente_id",
  cst_pis: "cat_pis",
  cst_cofins: "cat_cofins",
  cst_icms: "cat_icms",
};

const mapColumnToSelect = (column) => {
  const trimmed = column.trim();
  if (!trimmed || !allowedColumns.includes(trimmed)) {
    return null;
  }

  const actualColumn = columnAliasMap[trimmed] || trimmed;
  if (columnAliasMap[trimmed]) {
    return `${actualColumn} AS ${trimmed}`;
  }
  if (trimmed === "cliente_id") {
    return "cliente_id AS clientes_id";
  }
  return actualColumn;
};

const mapRowToApi = (row) => ({
  ...row,
  clientes_id: row.clientes_id ?? row.cliente_id ?? null,
  cst_pis: row.cst_pis ?? row.cat_pis ?? null,
  cst_cofins: row.cst_cofins ?? row.cat_cofins ?? null,
  cst_icms: row.cst_icms ?? row.cat_icms ?? null,
});


// POST /notas-fiscais - Criar nova nota fiscal
router.post("/", verifyToken, async (req, res) => {
  try {
    const { 
      clientes_id,
      chave_nfe,
      numero_nfe,
      serie,
      data_emissao,
      data_saida_entrada,
      data_importacao,
      cnpj_emitente,
      razao_social_emitente,
      cnpj_destinatario,
      razao_social_destinatario,
      uf_origem,
      uf_destino,
      estado_origem,
      estado_destino,
      valor_total_nfe,
      quantidade,
      valor_unitario,
      valor_total_item,
      pis,
      cofins,
      icms,
      valor_iss_ret,
      iss_ret,
      natureza_operacao,
      modelo,
      ncm_notas,
      ncm,
      cst_pis,
      cst_cofins,
      cst_icms,
      cfop,
      descricao_produto
    } = req.body;
    
    // Validações obrigatórias
    if (!clientes_id || !chave_nfe || !numero_nfe || !serie || !data_emissao || 
        !cnpj_emitente || !cnpj_destinatario || !valor_total_nfe) {
      return res.status(400).json({ 
        error: "Campos obrigatórios: clientes_id, chave_nfe, numero_nfe, serie, data_emissao, cnpj_emitente, cnpj_destinatario, valor_total_nfe" 
      });
    }

    // Validar formato da chave NFe (44 dígitos)
    if (!/^\d{44}$/.test(chave_nfe.replace(/\D/g, ""))) {
      return res.status(400).json({ 
        error: "Chave NFe deve ter 44 dígitos" 
      });
    }

    // Validar formato do CNPJ (14 dígitos)
    const cleanCnpjEmitente = sanitizeCnpj(cnpj_emitente);
    if (!cleanCnpjEmitente || !/^\d{14}$/.test(cleanCnpjEmitente)) {
      return res.status(400).json({ 
        error: "CNPJ emitente deve ter 14 dígitos" 
      });
    }

    const cleanCnpjDestinatario = sanitizeCnpj(cnpj_destinatario);
    if (!cleanCnpjDestinatario || !/^\d{14}$/.test(cleanCnpjDestinatario)) {
      return res.status(400).json({ 
        error: "CNPJ destinatário deve ter 14 dígitos" 
      });
    }

    const clienteId = Number.parseInt(clientes_id, 10);
    if (Number.isNaN(clienteId)) {
      return res.status(400).json({ error: "clientes_id inválido" });
    }

    const [[clienteRow]] = await pool.query(
      `
        SELECT id, empresa_id
        FROM clientes
        WHERE id = ?
        LIMIT 1
      `,
      [clienteId]
    );

    if (!clienteRow) {
      return res.status(400).json({ 
        error: "Cliente não encontrado" 
      });
    }

    const [[duplicateRow]] = await pool.query(
      `
        SELECT id
        FROM notas_fiscais
        WHERE cliente_id = ?
          AND chave_nfe = ?
        LIMIT 1
      `,
      [clienteRow.id, chave_nfe]
    );

    if (duplicateRow) {
      return res.status(400).json({ 
        error: "Nota fiscal já cadastrada para este cliente" 
      });
    }

    const insertValues = [
      clienteRow.id,
      chave_nfe,
      numero_nfe,
      serie,
      data_emissao,
      data_saida_entrada || null,
      toMySQLDatetime(data_importacao),
      cleanCnpjEmitente,
      razao_social_emitente || null,
      cleanCnpjDestinatario,
      razao_social_destinatario || null,
      uf_origem ? uf_origem.toUpperCase() : null,
      uf_destino ? uf_destino.toUpperCase() : null,
      estado_origem || null,
      estado_destino || null,
      valor_total_nfe ?? null,
      quantidade ?? null,
      valor_unitario ?? null,
      valor_total_item ?? null,
      pis ?? null,
      cofins ?? null,
      icms ?? null,
      valor_iss_ret ?? null,
      iss_ret ?? null,
      natureza_operacao || null,
      modelo || null,
      ncm_notas || null,
      ncm || null,
      cst_pis ?? null,
      cst_cofins ?? null,
      cst_icms ?? null,
      cfop || null,
      descricao_produto || null,
    ];

    const [insertResult] = await pool.query(
      `
        INSERT INTO notas_fiscais (
          cliente_id,
          chave_nfe,
          numero_nfe,
          serie,
          data_emissao,
          data_saida_entrada,
          data_importacao,
          cnpj_emitente,
          razao_social_emitente,
          cnpj_destinatario,
          razao_social_destinatario,
          uf_origem,
          uf_destino,
          estado_origem,
          estado_destino,
          valor_total_nfe,
          quantidade,
          valor_unitario,
          valor_total_item,
          pis,
          cofins,
          icms,
          valor_iss_ret,
          iss_ret,
          natureza_operacao,
          modelo,
          ncm_notas,
          ncm,
          cat_pis,
          cat_cofins,
          cat_icms,
          cfop,
          descricao_produto
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      insertValues
    );

    const insertedId = insertResult.insertId;

    const [[insertedRow]] = await pool.query(
      `
        SELECT
          id,
          cliente_id AS clientes_id,
          chave_nfe,
          numero_nfe,
          serie,
          data_emissao,
          data_saida_entrada,
          data_importacao,
          cnpj_emitente,
          razao_social_emitente,
          cnpj_destinatario,
          razao_social_destinatario,
          uf_origem,
          uf_destino,
          estado_origem,
          estado_destino,
          valor_total_nfe,
          quantidade,
          valor_unitario,
          valor_total_item,
          pis,
          cofins,
          icms,
          valor_iss_ret,
          iss_ret,
          natureza_operacao,
          modelo,
          ncm_notas,
          ncm,
          cat_pis AS cst_pis,
          cat_cofins AS cst_cofins,
          cat_icms AS cst_icms,
          cfop,
          descricao_produto,
          criado_em,
          atualizado_em
        FROM notas_fiscais
        WHERE id = ?
        LIMIT 1
      `,
      [insertedId]
    );

    res.status(201).json(mapRowToApi(insertedRow));
  } catch (err) {
    console.error('Erro ao criar nota fiscal:', err);
    res.status(500).json({ error: "Erro interno do servidor." });
  }
});

// GET /notas-fiscais - Listar notas fiscais com filtros
router.get("/", verifyToken, async (req, res) => {
  try {
    const { 
      clientes_id,
      chave_nfe,
      numero_nfe,
      cnpj_emitente,
      cnpj_destinatario,
      data_emissao_inicio,
      data_emissao_fim,
      uf_origem,
      uf_destino,
      ncm,
      cfop,
      sort_by = 'data_emissao',
      sort_order = 'desc'
    } = req.query;

    // clientes_id é obrigatório para segurança
    if (!clientes_id) {
      return res.status(400).json({ 
        error: "clientes_id é obrigatório" 
      });
    }

    const clienteId = Number.parseInt(clientes_id, 10);
    if (Number.isNaN(clienteId)) {
      return res.status(400).json({ error: "clientes_id inválido" });
    }

    const [[clienteRow]] = await pool.query(
      `
        SELECT id, empresa_id
        FROM clientes
        WHERE id = ?
        LIMIT 1
      `,
      [clienteId]
    );

    if (!clienteRow) {
      return res.status(404).json({ error: "Cliente não encontrado" });
    }

    const filtros = ["nf.cliente_id = ?"];
    const params = [clienteRow.id];

    if (chave_nfe) {
      filtros.push("nf.chave_nfe = ?");
      params.push(chave_nfe);
    }

    if (numero_nfe) {
      filtros.push("nf.numero_nfe = ?");
      params.push(numero_nfe);
    }

    if (cnpj_emitente) {
      filtros.push("REPLACE(REPLACE(REPLACE(nf.cnpj_emitente, '.', ''), '-', ''), '/', '') = ?");
      params.push(sanitizeCnpj(cnpj_emitente));
    }

    if (cnpj_destinatario) {
      filtros.push("REPLACE(REPLACE(REPLACE(nf.cnpj_destinatario, '.', ''), '-', ''), '/', '') = ?");
      params.push(sanitizeCnpj(cnpj_destinatario));
    }

    if (data_emissao_inicio) {
      filtros.push("nf.data_emissao >= ?");
      params.push(data_emissao_inicio);
    }

    if (data_emissao_fim) {
      filtros.push("nf.data_emissao <= ?");
      params.push(data_emissao_fim);
    }

    if (uf_origem) {
      filtros.push("nf.uf_origem = ?");
      params.push(uf_origem.toUpperCase());
    }

    if (uf_destino) {
      filtros.push("nf.uf_destino = ?");
      params.push(uf_destino.toUpperCase());
    }

    if (ncm) {
      filtros.push("nf.ncm LIKE ?");
      params.push(`%${ncm}%`);
    }

    if (cfop) {
      filtros.push("nf.cfop = ?");
      params.push(cfop);
    }

    const whereClause = filtros.length ? `WHERE ${filtros.join(" AND ")}` : "";

    const camposOrdenacao = {
      chave_nfe: "nf.chave_nfe",
      numero_nfe: "nf.numero_nfe",
      data_emissao: "nf.data_emissao",
      valor_total_nfe: "nf.valor_total_nfe",
      cnpj_emitente: "nf.cnpj_emitente",
      cnpj_destinatario: "nf.cnpj_destinatario",
    };

    const sortColumn = camposOrdenacao[sort_by] || "nf.data_emissao";
    const sortDirection = sort_order === "asc" ? "ASC" : "DESC";

    const [rows] = await pool.query(
      `
        SELECT
          nf.id,
          nf.cliente_id AS clientes_id,
          nf.chave_nfe,
          nf.numero_nfe,
          nf.serie,
          nf.data_emissao,
          nf.data_saida_entrada,
          nf.data_importacao,
          nf.cnpj_emitente,
          nf.razao_social_emitente,
          nf.cnpj_destinatario,
          nf.razao_social_destinatario,
          nf.uf_origem,
          nf.uf_destino,
          nf.estado_origem,
          nf.estado_destino,
          nf.valor_total_nfe,
          nf.quantidade,
          nf.valor_unitario,
          nf.valor_total_item,
          nf.pis,
          nf.cofins,
          nf.icms,
          nf.valor_iss_ret,
          nf.iss_ret,
          nf.natureza_operacao,
          nf.modelo,
          nf.ncm_notas,
          nf.ncm,
          nf.cat_pis AS cst_pis,
          nf.cat_cofins AS cst_cofins,
          nf.cat_icms AS cst_icms,
          nf.cfop,
          nf.descricao_produto,
          nf.criado_em,
          nf.atualizado_em
        FROM notas_fiscais AS nf
        ${whereClause}
        ORDER BY ${sortColumn} ${sortDirection}
      `,
      params
    );

    res.json({
      data: rows.map(mapRowToApi),
    });
  } catch (err) {
    console.error('Erro ao buscar notas fiscais:', err);
    res.status(500).json({ error: "Erro interno do servidor." });
  }
});

// GET /notas-fiscais/periodo - Buscar notas fiscais por período
router.get("/periodo", verifyToken, async (req, res) => {
  try {
    const { 
      clientes_id,
      cnpj_emitente,
      data_inicio,
      data_fim,
      ano,
      mes,
      select = '*'
    } = req.query;

    // Priorizar clientes_id, fallback para cnpj_emitente
    if (!clientes_id && !cnpj_emitente) {
      return res.status(400).json({ error: "clientes_id ou cnpj_emitente é obrigatório" });
    }

    let cliente;

    if (clientes_id) {
      const clienteIdParsed = Number.parseInt(clientes_id, 10);
      if (Number.isNaN(clienteIdParsed)) {
        return res.status(400).json({ error: "clientes_id inválido" });
      }

      const [[clienteRow]] = await pool.query(
        `
          SELECT id, empresa_id, cpf_cnpj
          FROM clientes
          WHERE id = ?
          LIMIT 1
        `,
        [clienteIdParsed]
      );

      if (!clienteRow) {
        return res.status(404).json({ error: "Cliente não encontrado" });
      }

      cliente = { id: clienteRow.id, company_id: clienteRow.empresa_id, cnpj: clienteRow.cpf_cnpj };
    } else {
      const cleanCnpj = sanitizeCnpj(cnpj_emitente);
      if (!cleanCnpj) {
        return res.status(400).json({ error: "CNPJ emitente inválido" });
      }

      const [[clienteRow]] = await pool.query(
        `
          SELECT id, empresa_id, cpf_cnpj
          FROM clientes
          WHERE REPLACE(REPLACE(REPLACE(cpf_cnpj, '.', ''), '-', ''), '/', '') = ?
            AND empresa_id IN (?)
          LIMIT 1
        `,
        [cleanCnpj, req.user.all_company_ids]
      );

      if (!clienteRow) {
        return res.status(404).json({ error: "Cliente não encontrado" });
      }

      cliente = { id: clienteRow.id, company_id: clienteRow.empresa_id, cnpj: clienteRow.cpf_cnpj };
    }

    if (!req.user.all_company_ids.includes(cliente.company_id)) {
      return res.status(403).json({ error: "Acesso negado ao cliente" });
    }

    // Validar e processar o parâmetro select
    let selectFields = '*';
    if (select && select !== '*') {
      try {
        // Dividir por vírgula e remover espaços em branco
        const parsedFields = select.split(',').map(field => field.trim()).filter(field => field.length > 0);
        
        // Se não há campos válidos, usar '*'
        if (parsedFields.length === 0) {
          selectFields = '*';
        } else {
          // Manter como string para o Supabase
          selectFields = parsedFields.join(',');
        }
      } catch (parseError) {
        console.error('Erro ao processar parâmetro select:', parseError);
        selectFields = '*';
      }
    }

    console.log('Query parameters:', { clientes_id, cnpj_emitente, data_inicio, data_fim, ano, mes, select: selectFields });

    let selectClause = `
      nf.id,
      nf.cliente_id AS clientes_id,
      nf.chave_nfe,
      nf.numero_nfe,
      nf.serie,
      nf.data_emissao,
      nf.data_saida_entrada,
      nf.data_importacao,
      nf.cnpj_emitente,
      nf.razao_social_emitente,
      nf.cnpj_destinatario,
      nf.razao_social_destinatario,
      nf.uf_origem,
      nf.uf_destino,
      nf.estado_origem,
      nf.estado_destino,
      nf.valor_total_nfe,
      nf.quantidade,
      nf.valor_unitario,
      nf.valor_total_item,
      nf.pis,
      nf.cofins,
      nf.icms,
      nf.valor_iss_ret,
      nf.iss_ret,
      nf.natureza_operacao,
      nf.modelo,
      nf.ncm_notas,
      nf.ncm,
      nf.cat_pis AS cst_pis,
      nf.cat_cofins AS cst_cofins,
      nf.cat_icms AS cst_icms,
      nf.cfop,
      nf.descricao_produto,
      nf.criado_em,
      nf.atualizado_em
    `;

    if (selectFields !== "*") {
      const requested = selectFields
        .split(",")
        .map((col) => mapColumnToSelect(col))
        .filter(Boolean);
      if (requested.length) {
        selectClause = requested.join(", ");
      }
    }

    const filtros = ["nf.cliente_id = ?"];
    const params = [cliente.id];

    if (data_inicio) {
      filtros.push("nf.data_emissao >= ?");
      params.push(data_inicio);
    }
    if (data_fim) {
      filtros.push("nf.data_emissao <= ?");
      params.push(data_fim);
    }
    if (ano) {
      filtros.push("nf.data_emissao >= ?");
      filtros.push("nf.data_emissao <= ?");
      params.push(`${ano}-01-01`, `${ano}-12-31`);
    }
    if (mes && ano) {
      const mesInt = Number.parseInt(mes, 10);
      if (!Number.isNaN(mesInt)) {
        const ultimoDia = new Date(ano, mesInt, 0).getDate();
        filtros.push("nf.data_emissao >= ?");
        filtros.push("nf.data_emissao <= ?");
        params.push(
          `${ano}-${mesInt.toString().padStart(2, "0")}-01`,
          `${ano}-${mesInt.toString().padStart(2, "0")}-${ultimoDia}`
        );
      }
    }

    const whereClause = filtros.length ? `WHERE ${filtros.join(" AND ")}` : "";

    const [rows] = await pool.query(
      `
        SELECT ${selectClause}
        FROM notas_fiscais AS nf
        ${whereClause}
        ORDER BY nf.data_emissao DESC
      `,
      params
    );

    res.json({ data: rows.map(mapRowToApi) });
  } catch (err) {
    console.error('Erro ao buscar notas fiscais por período:', err);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

// GET /notas-fiscais/iss-retido - Buscar notas fiscais com ISS retido
router.get("/iss-retido", verifyToken, async (req, res) => {
  try {
    const { 
      clientes_id,
      cnpj_emitente,
      ano
    } = req.query;

    // Priorizar clientes_id, fallback para cnpj_emitente
    if (!clientes_id && !cnpj_emitente) {
      return res.status(400).json({ error: "clientes_id ou cnpj_emitente é obrigatório" });
    }

    console.log('ISS Retido query parameters:', { clientes_id, cnpj_emitente, ano });

    let cliente;

    if (clientes_id) {
      const clienteIdParsed = Number.parseInt(clientes_id, 10);
      if (Number.isNaN(clienteIdParsed)) {
        return res.status(400).json({ error: "clientes_id inválido" });
      }

      const [[clienteRow]] = await pool.query(
        `
          SELECT id, empresa_id, cpf_cnpj
          FROM clientes
          WHERE id = ?
          LIMIT 1
        `,
        [clienteIdParsed]
      );

      if (!clienteRow) {
        return res.status(404).json({ error: "Cliente não encontrado" });
      }

      cliente = { id: clienteRow.id, company_id: clienteRow.empresa_id, cnpj: clienteRow.cpf_cnpj };
    } else {
      const cleanCnpj = sanitizeCnpj(cnpj_emitente);
      if (!cleanCnpj) {
        return res.status(400).json({ error: "CNPJ emitente inválido" });
      }

      const [[clienteRow]] = await pool.query(
        `
          SELECT id, empresa_id, cpf_cnpj
          FROM clientes
          WHERE REPLACE(REPLACE(REPLACE(cpf_cnpj, '.', ''), '-', ''), '/', '') = ?
            AND empresa_id IN (?)
          LIMIT 1
        `,
        [cleanCnpj, req.user.all_company_ids]
      );

      if (!clienteRow) {
        return res.status(404).json({ error: "Cliente não encontrado" });
      }

      cliente = { id: clienteRow.id, company_id: clienteRow.empresa_id, cnpj: clienteRow.cpf_cnpj };
    }

    if (!req.user.all_company_ids.includes(cliente.company_id)) {
      return res.status(403).json({ error: "Acesso negado ao cliente" });
    }

    const filtros = [
      "nf.cliente_id = ?",
      "nf.iss_ret IS NOT NULL",
      "nf.valor_iss_ret IS NOT NULL",
      "(nf.iss_ret <> 0)"
    ];
    const params = [cliente.id];

    if (ano) {
      filtros.push("nf.data_emissao >= ?");
      filtros.push("nf.data_emissao <= ?");
      params.push(`${ano}-01-01`, `${ano}-12-31`);
    }

    const whereClause = filtros.length ? `WHERE ${filtros.join(" AND ")}` : "";

    const [rows] = await pool.query(
      `
        SELECT
          nf.data_emissao,
          nf.valor_iss_ret,
          nf.iss_ret,
          nf.id,
          nf.cliente_id AS clientes_id
        FROM notas_fiscais AS nf
        ${whereClause}
        ORDER BY nf.data_emissao DESC
      `,
      params
    );

    res.json({ data: rows.map(mapRowToApi) });
  } catch (err) {
    console.error('Erro ao buscar notas fiscais com ISS retido:', err);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

// GET /notas-fiscais/:id - Buscar nota fiscal por ID
router.get("/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    const notaId = Number.parseInt(id, 10);
    if (Number.isNaN(notaId)) {
      return res.status(400).json({ error: "ID inválido" });
    }

    const [[notaRow]] = await pool.query(
      `
        SELECT
          nf.id,
          nf.cliente_id AS clientes_id,
          nf.chave_nfe,
          nf.numero_nfe,
          nf.serie,
          nf.data_emissao,
          nf.data_saida_entrada,
          nf.data_importacao,
          nf.cnpj_emitente,
          nf.razao_social_emitente,
          nf.cnpj_destinatario,
          nf.razao_social_destinatario,
          nf.uf_origem,
          nf.uf_destino,
          nf.estado_origem,
          nf.estado_destino,
          nf.valor_total_nfe,
          nf.quantidade,
          nf.valor_unitario,
          nf.valor_total_item,
          nf.pis,
          nf.cofins,
          nf.icms,
          nf.valor_iss_ret,
          nf.iss_ret,
          nf.natureza_operacao,
          nf.modelo,
          nf.ncm_notas,
          nf.ncm,
          nf.cat_pis AS cst_pis,
          nf.cat_cofins AS cst_cofins,
          nf.cat_icms AS cst_icms,
          nf.cfop,
          nf.descricao_produto,
          nf.criado_em,
          nf.atualizado_em
        FROM notas_fiscais AS nf
        INNER JOIN clientes AS c ON c.id = nf.cliente_id
        WHERE nf.id = ?
          AND c.empresa_id IN (?)
        LIMIT 1
      `,
      [notaId, req.user.all_company_ids]
    );

    if (!notaRow) {
      return res.status(404).json({ error: "Nota fiscal não encontrada." });
    }

    res.json(mapRowToApi(notaRow));
  } catch (err) {
    console.error('Erro ao buscar nota fiscal:', err);
    res.status(500).json({ error: "Erro interno do servidor." });
  }
});

// PUT /notas-fiscais/:id - Atualizar nota fiscal
router.put("/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      chave_nfe,
      numero_nfe,
      serie,
      data_emissao,
      data_saida_entrada,
      data_importacao,
      cnpj_emitente,
      razao_social_emitente,
      cnpj_destinatario,
      razao_social_destinatario,
      uf_origem,
      uf_destino,
      estado_origem,
      estado_destino,
      valor_total_nfe,
      quantidade,
      valor_unitario,
      valor_total_item,
      pis,
      cofins,
      icms,
      valor_iss_ret,
      iss_ret,
      natureza_operacao,
      modelo,
      ncm_notas,
      ncm,
      cst_pis,
      cst_cofins,
      cst_icms,
      cfop,
      descricao_produto
    } = req.body;

    // Validações obrigatórias
    if (!chave_nfe || !numero_nfe || !serie || !data_emissao || 
        !cnpj_emitente || !cnpj_destinatario || !valor_total_nfe) {
      return res.status(400).json({ 
        error: "Campos obrigatórios: chave_nfe, numero_nfe, serie, data_emissao, cnpj_emitente, cnpj_destinatario, valor_total_nfe" 
      });
    }

    const notaId = Number.parseInt(id, 10);
    if (Number.isNaN(notaId)) {
      return res.status(400).json({ error: "ID inválido" });
    }

    const [[existingNota]] = await pool.query(
      `
        SELECT id, cliente_id
        FROM notas_fiscais
        WHERE id = ?
        LIMIT 1
      `,
      [notaId]
    );

    if (!existingNota) {
      return res.status(404).json({ error: "Nota fiscal não encontrada." });
    }

    const [[clienteRow]] = await pool.query(
      `
        SELECT empresa_id
        FROM clientes
        WHERE id = ?
        LIMIT 1
      `,
      [existingNota.cliente_id]
    );

    if (!clienteRow) {
      return res.status(400).json({ error: "Cliente não encontrado" });
    }

    const [[duplicateNota]] = await pool.query(
      `
        SELECT id
        FROM notas_fiscais
        WHERE cliente_id = ?
          AND chave_nfe = ?
          AND id <> ?
        LIMIT 1
      `,
      [existingNota.cliente_id, chave_nfe, notaId]
    );

    if (duplicateNota) {
      return res.status(400).json({ 
        error: "Chave NFe já cadastrada para este cliente" 
      });
    }

    const cleanCnpjEmitente = sanitizeCnpj(cnpj_emitente);
    const cleanCnpjDestinatario = sanitizeCnpj(cnpj_destinatario);

    const updateValues = [
      chave_nfe,
      numero_nfe,
      serie,
      data_emissao,
      data_saida_entrada || null,
      toMySQLDatetime(data_importacao),
      cleanCnpjEmitente,
      razao_social_emitente || null,
      cleanCnpjDestinatario,
      razao_social_destinatario || null,
      uf_origem ? uf_origem.toUpperCase() : null,
      uf_destino ? uf_destino.toUpperCase() : null,
      estado_origem || null,
      estado_destino || null,
      valor_total_nfe ?? null,
      quantidade ?? null,
      valor_unitario ?? null,
      valor_total_item ?? null,
      pis ?? null,
      cofins ?? null,
      icms ?? null,
      valor_iss_ret ?? null,
      iss_ret ?? null,
      natureza_operacao || null,
      modelo || null,
      ncm_notas || null,
      ncm || null,
      cst_pis ?? null,
      cst_cofins ?? null,
      cst_icms ?? null,
      cfop || null,
      descricao_produto || null,
      notaId,
    ];

    await pool.query(
      `
        UPDATE notas_fiscais
        SET
          chave_nfe = ?,
          numero_nfe = ?,
          serie = ?,
          data_emissao = ?,
          data_saida_entrada = ?,
          data_importacao = ?,
          cnpj_emitente = ?,
          razao_social_emitente = ?,
          cnpj_destinatario = ?,
          razao_social_destinatario = ?,
          uf_origem = ?,
          uf_destino = ?,
          estado_origem = ?,
          estado_destino = ?,
          valor_total_nfe = ?,
          quantidade = ?,
          valor_unitario = ?,
          valor_total_item = ?,
          pis = ?,
          cofins = ?,
          icms = ?,
          valor_iss_ret = ?,
          iss_ret = ?,
          natureza_operacao = ?,
          modelo = ?,
          ncm_notas = ?,
          ncm = ?,
          cat_pis = ?,
          cat_cofins = ?,
          cat_icms = ?,
          cfop = ?,
          descricao_produto = ?,
          atualizado_em = NOW()
        WHERE id = ?
      `,
      updateValues
    );

    const [[updatedRow]] = await pool.query(
      `
        SELECT
          nf.id,
          nf.cliente_id AS clientes_id,
          nf.chave_nfe,
          nf.numero_nfe,
          nf.serie,
          nf.data_emissao,
          nf.data_saida_entrada,
          nf.data_importacao,
          nf.cnpj_emitente,
          nf.razao_social_emitente,
          nf.cnpj_destinatario,
          nf.razao_social_destinatario,
          nf.uf_origem,
          nf.uf_destino,
          nf.estado_origem,
          nf.estado_destino,
          nf.valor_total_nfe,
          nf.quantidade,
          nf.valor_unitario,
          nf.valor_total_item,
          nf.pis,
          nf.cofins,
          nf.icms,
          nf.valor_iss_ret,
          nf.iss_ret,
          nf.natureza_operacao,
          nf.modelo,
          nf.ncm_notas,
          nf.ncm,
          nf.cat_pis AS cst_pis,
          nf.cat_cofins AS cst_cofins,
          nf.cat_icms AS cst_icms,
          nf.cfop,
          nf.descricao_produto,
          nf.criado_em,
          nf.atualizado_em
        FROM notas_fiscais AS nf
        WHERE nf.id = ?
        LIMIT 1
      `,
      [notaId]
    );

    res.json(mapRowToApi(updatedRow));
  } catch (err) {
    console.error('Erro ao atualizar nota fiscal:', err);
    res.status(500).json({ error: "Erro interno do servidor." });
  }
});

// DELETE /notas-fiscais/:id - Deletar nota fiscal
router.delete("/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    const notaId = Number.parseInt(id, 10);
    if (Number.isNaN(notaId)) {
      return res.status(400).json({ error: "ID inválido" });
    }

    const [[existingNota]] = await pool.query(
      `
        SELECT nf.id, nf.cliente_id, c.empresa_id
        FROM notas_fiscais AS nf
        INNER JOIN clientes AS c ON c.id = nf.cliente_id
        WHERE nf.id = ?
        LIMIT 1
      `,
      [notaId]
    );

    if (!existingNota) {
      return res.status(404).json({ error: "Nota fiscal não encontrada." });
    }

    const [deleteResult] = await pool.query(
      `
        DELETE FROM notas_fiscais
        WHERE id = ?
      `,
      [notaId]
    );

    if (deleteResult.affectedRows === 0) {
      return res.status(500).json({ error: "Erro ao deletar nota fiscal." });
    }

    res.json({ message: "Nota fiscal deletada com sucesso." });
  } catch (err) {
    console.error('Erro ao deletar nota fiscal:', err);
    res.status(500).json({ error: "Erro interno do servidor." });
  }
});

// POST /notas-fiscais/bulk - Criar múltiplas notas fiscais
router.post("/bulk", verifyToken, async (req, res) => {
  try {
    const { notas_fiscais } = req.body;

    if (!notas_fiscais || !Array.isArray(notas_fiscais) || notas_fiscais.length === 0) {
      return res.status(400).json({ 
        error: "Array de notas fiscais é obrigatório" 
      });
    }

    if (notas_fiscais.length > 100) {
      return res.status(400).json({ 
        error: "Máximo de 100 notas fiscais por operação" 
      });
    }

    const notasValidadas = [];
    const erros = [];
    let sucessosCount = 0;
    const duplicadas = [];

    // Validar cada nota fiscal
    for (let i = 0; i < notas_fiscais.length; i++) {
      const nota = notas_fiscais[i];
      
      // Validações obrigatórias
      if (!nota.clientes_id || !nota.chave_nfe || !nota.numero_nfe || !nota.serie || 
          !nota.data_emissao || !nota.cnpj_emitente || !nota.cnpj_destinatario || 
          !nota.valor_total_nfe) {
        erros.push(`Nota ${i + 1}: Campos obrigatórios: clientes_id, chave_nfe, numero_nfe, serie, data_emissao, cnpj_emitente, cnpj_destinatario, valor_total_nfe`);
        continue;
      }

      // Validar formato da chave NFe (44 dígitos)
      if (!/^\d{44}$/.test(nota.chave_nfe.replace(/\D/g, ""))) {
        erros.push(`Nota ${i + 1}: Chave NFe deve ter 44 dígitos`);
        continue;
      }

      // Validar formato do CNPJ (14 dígitos)
      const cleanCnpjEmitente = sanitizeCnpj(nota.cnpj_emitente);
      if (!cleanCnpjEmitente || !/^\d{14}$/.test(cleanCnpjEmitente)) {
        erros.push(`Nota ${i + 1}: CNPJ emitente deve ter 14 dígitos`);
        continue;
      }

      const cleanCnpjDestinatario = sanitizeCnpj(nota.cnpj_destinatario);
      if (!cleanCnpjDestinatario || !/^\d{14}$/.test(cleanCnpjDestinatario)) {
        erros.push(`Nota ${i + 1}: CNPJ destinatário deve ter 14 dígitos`);
        continue;
      }

      const clienteIdParsed = Number.parseInt(nota.clientes_id, 10);
      if (Number.isNaN(clienteIdParsed)) {
        erros.push(`Nota ${i + 1}: clientes_id inválido`);
        continue;
      }

      const [[clienteRow]] = await pool.query(
        `
          SELECT id, empresa_id
          FROM clientes
          WHERE id = ?
          LIMIT 1
        `,
        [clienteIdParsed]
      );

      if (!clienteRow) {
        erros.push(`Nota ${i + 1}: Cliente não encontrado`);
        continue;
      }

      // Verificar se NFe já existe para este cliente (evitar duplicatas)
      const [[existingNFe]] = await pool.query(
        `
          SELECT id, numero_nfe
          FROM notas_fiscais
          WHERE cliente_id = ?
            AND chave_nfe = ?
          LIMIT 1
        `,
        [clienteRow.id, nota.chave_nfe]
      );

      if (existingNFe) {
        duplicadas.push({
          linha: i + 1,
          chave_nfe: nota.chave_nfe,
          numero_nfe: nota.numero_nfe,
          numero_nfe_existente: existingNFe.numero_nfe,
          motivo: "Nota fiscal já cadastrada para este cliente"
        });
        continue;
      }

      // Adicionar data de importação
      notasValidadas.push({
        ...nota,
        clientes_id: clienteRow.id,
        cliente_id: clienteRow.id,
        data_importacao: toMySQLDatetime(new Date()),
        cnpj_emitente: cleanCnpjEmitente,
        cnpj_destinatario: cleanCnpjDestinatario,
        uf_origem: nota.uf_origem ? nota.uf_origem.toUpperCase() : null,
        uf_destino: nota.uf_destino ? nota.uf_destino.toUpperCase() : null,
      });
    }

    // Inserir notas válidas
    if (notasValidadas.length > 0) {
      const insertValues = notasValidadas.map((nota) => [
        nota.cliente_id,
        nota.chave_nfe,
        nota.numero_nfe,
        nota.serie,
        nota.data_emissao,
        nota.data_saida_entrada || null,
        nota.data_importacao || null,
        nota.cnpj_emitente,
        nota.razao_social_emitente || null,
        nota.cnpj_destinatario,
        nota.razao_social_destinatario || null,
        nota.uf_origem,
        nota.uf_destino,
        nota.estado_origem || null,
        nota.estado_destino || null,
        nota.valor_total_nfe ?? null,
        nota.quantidade ?? null,
        nota.valor_unitario ?? null,
        nota.valor_total_item ?? null,
        nota.pis ?? null,
        nota.cofins ?? null,
        nota.icms ?? null,
        nota.valor_iss_ret ?? null,
        nota.iss_ret ?? null,
        nota.natureza_operacao || null,
        nota.modelo || null,
        nota.ncm_notas || null,
        nota.ncm || null,
        nota.cst_pis ?? null,
        nota.cst_cofins ?? null,
        nota.cst_icms ?? null,
        nota.cfop || null,
        nota.descricao_produto || null,
      ]);

      try {
        await pool.query(
          `
            INSERT INTO notas_fiscais (
              cliente_id,
              chave_nfe,
              numero_nfe,
              serie,
              data_emissao,
              data_saida_entrada,
              data_importacao,
              cnpj_emitente,
              razao_social_emitente,
              cnpj_destinatario,
              razao_social_destinatario,
              uf_origem,
              uf_destino,
              estado_origem,
              estado_destino,
              valor_total_nfe,
              quantidade,
              valor_unitario,
              valor_total_item,
              pis,
              cofins,
              icms,
              valor_iss_ret,
              iss_ret,
              natureza_operacao,
              modelo,
              ncm_notas,
              ncm,
              cat_pis,
              cat_cofins,
              cat_icms,
              cfop,
              descricao_produto
            ) VALUES ?
          `,
          [insertValues]
        );
        sucessosCount += notasValidadas.length;
      } catch (insertError) {
        console.error('Erro ao inserir notas fiscais em lote:', insertError);
        return res.status(500).json({ error: "Erro ao inserir notas fiscais em lote." });
      }
    }

    res.status(201).json({
      message: `${sucessosCount} notas fiscais criadas com sucesso`,
      sucessos: sucessosCount,
      erros: erros.length,
      duplicadas: duplicadas.length,
      detalhes_erros: erros,
      detalhes_duplicadas: duplicadas
    });
  } catch (err) {
    console.error('Erro ao criar notas fiscais em lote:', err);
    res.status(500).json({ error: "Erro interno do servidor." });
  }
});

module.exports = router;
