const express = require("express");
const router = express.Router();
const pool = require("../../config/database");
const { verifyToken } = require("../../middlewares/auth");
const consultaCnaeService = require("../../services/auditoria/ConsultaCnae");

// ===== ROTAS PARA TABELA CNAE_INFO =====

// POST /cnae-info/consultar - Consultar CNAEs na API da LegisWeb
router.post("/consultar", verifyToken, async (req, res) => {
  try {
    const { cnpj } = req.body;
    
    // Validações obrigatórias
    if (!cnpj) {
      return res.status(400).json({ 
        error: "CNPJ é obrigatório" 
      });
    }

    // Validar formato do CNPJ
    const cleanCnpj = cnpj.replace(/[^\d]/g, '');
    if (cleanCnpj.length !== 14) {
      return res.status(400).json({ 
        error: "CNPJ deve ter 14 dígitos" 
      });
    }

    console.log(`[CNAE Info] Consultando CNAEs para CNPJ: ${cleanCnpj}`);

    // Consultar CNAEs na LegisWeb
    const resultado = await consultaCnaeService.consultarCnaes(cleanCnpj);

    res.json({
      success: true,
      message: `CNAEs consultados com sucesso. Encontrados ${resultado.total_cnaes} CNAEs.`,
      data: resultado
    });

  } catch (err) {
    console.error('Erro ao consultar CNAEs:', err);
    
    // Tratar erros específicos da LegisWeb
    if (err.message.includes('Empresa não encontrada')) {
      return res.status(404).json({ 
        error: "Empresa não encontrada na LegisWeb",
        details: err.message 
      });
    }
    
    if (err.message.includes('Credenciais da LegisWeb')) {
      return res.status(500).json({ 
        error: "Erro de configuração da API LegisWeb",
        details: err.message 
      });
    }
    
    res.status(500).json({ 
      error: "Erro interno do servidor ao consultar CNAEs",
      details: err.message 
    });
  }
});

// POST /cnae-info/consultar-e-salvar - Consultar CNAEs e salvar automaticamente
router.post("/consultar-e-salvar", verifyToken, async (req, res) => {
  try {
    const { cnpj, clientes_id } = req.body;

    if (!cnpj || !clientes_id) {
      return res.status(400).json({
        error: "CNPJ e clientes_id são obrigatórios"
      });
    }

    const cleanCnpj = cnpj.replace(/[^\d]/g, "");
    if (cleanCnpj.length !== 14) {
      return res.status(400).json({
        error: "CNPJ deve ter 14 dígitos"
      });
    }

    console.log(`[CNAE Info] Consultando e salvando CNAEs para CNPJ: ${cleanCnpj}, Clientes ID: ${clientes_id}`);

    const resultado = await consultaCnaeService.consultarCnaes(cleanCnpj);
    const cnaesSalvos = [];
    const erros = [];

    for (const cnae of resultado.cnaes) {
      try {
        const [existe] = await pool.query(
          `
            SELECT id
            FROM cnae_info
            WHERE cliente_id = ?
              AND cnae = ?
            LIMIT 1
          `,
          [clientes_id, cnae.codigo]
        );

        if (existe.length) {
          console.log(`[CNAE Info] CNAE ${cnae.codigo} já existe para clientes_id ${clientes_id}`);
          continue;
        }

        const [insertResult] = await pool.query(
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
            clientes_id,
            cnae.codigo,
            cnae.descricao,
            cnae.anexo,
            cnae.fator_r,
            cnae.aliquota,
            req.user.userId,
            req.user.userId
          ]
        );

        const [novoCnae] = await pool.query(
          `
            SELECT
              id,
              cliente_id AS clientes_id,
              cnae,
              descricao,
              anexo,
              fator_r,
              aliquota,
              criado_em AS created_at,
              criado_por AS created_by,
              NULL AS updated_at,
              atualizado_por AS updated_by
            FROM cnae_info
            WHERE id = ?
            LIMIT 1
          `,
          [insertResult.insertId]
        );

        if (novoCnae.length) {
          cnaesSalvos.push(novoCnae[0]);
          console.log(`[CNAE Info] CNAE ${cnae.codigo} salvo com sucesso`);
        }
      } catch (error) {
        console.error(`[CNAE Info] Erro ao processar CNAE ${cnae.codigo}:`, error);
        erros.push({
          cnae: cnae.codigo,
          erro: error.message
        });
      }
    }

    res.json({
      success: true,
      message: `Processamento concluído. ${cnaesSalvos.length} CNAEs salvos, ${erros.length} erros.`,
      data: {
        empresa: resultado.empresa,
        cnaes_salvos: cnaesSalvos,
        total_processados: resultado.cnaes.length,
        total_salvos: cnaesSalvos.length,
        erros
      }
    });
  } catch (err) {
    console.error("Erro ao consultar e salvar CNAEs:", err);

    if (err.message.includes("Empresa não encontrada")) {
      return res.status(404).json({
        error: "Empresa não encontrada na LegisWeb",
        details: err.message
      });
    }

    if (err.message.includes("Credenciais da LegisWeb")) {
      return res.status(500).json({
        error: "Erro de configuração da API LegisWeb",
        details: err.message
      });
    }

    res.status(500).json({
      error: "Erro interno do servidor ao consultar e salvar CNAEs",
      details: err.message
    });
  }
});

// POST /cnae-info - Criar nova informação CNAE
router.post("/", verifyToken, async (req, res) => {
  try {
    const {
      clientes_id,
      cnae,
      descricao,
      anexo,
      fator_r,
      aliquota
    } = req.body;

    if (!clientes_id || !cnae || !descricao || !anexo || fator_r === undefined || aliquota === undefined) {
      return res.status(400).json({
        error: "Todos os campos são obrigatórios: clientes_id, cnae, descricao, anexo, fator_r, aliquota"
      });
    }

    const [existe] = await pool.query(
      `
        SELECT id
        FROM cnae_info
        WHERE cliente_id = ?
          AND cnae = ?
        LIMIT 1
      `,
      [clientes_id, cnae]
    );

    if (existe.length) {
      return res.status(400).json({
        error: "CNAE já existe para este cliente"
      });
    }

    const [insertResult] = await pool.query(
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
      [clientes_id, cnae, descricao, anexo, fator_r, aliquota, req.user.userId, req.user.userId]
    );

    const [novoCnae] = await pool.query(
      `
        SELECT
          id,
          cliente_id AS clientes_id,
          cnae,
          descricao,
          anexo,
          fator_r,
          aliquota,
          criado_em AS created_at,
          criado_por AS created_by,
          NULL AS updated_at,
          atualizado_por AS updated_by
        FROM cnae_info
        WHERE id = ?
        LIMIT 1
      `,
      [insertResult.insertId]
    );

    res.status(201).json(novoCnae[0]);
  } catch (err) {
    console.error("Erro ao criar CNAE:", err);
    res.status(500).json({ error: "Erro interno do servidor." });
  }
});

// GET /cnae-info - Listar informações CNAE com filtros
router.get("/", verifyToken, async (req, res) => {
  try {
    const {
      clientes_id,
      cnae,
      descricao,
      anexo,
      page = 1,
      limit = 50,
      sort_by = "created_at",
      sort_order = "desc"
    } = req.query;

    if (!clientes_id) {
      return res.status(400).json({
        error: "clientes_id é obrigatório"
      });
    }

    const pagina = parseInt(page, 10) || 1;
    const limite = parseInt(limit, 10) || 50;
    const offset = (pagina - 1) * limite;

    const camposOrdenacao = {
      cnae: "cnae",
      descricao: "descricao",
      anexo: "anexo",
      created_at: "criado_em",
      updated_at: "criado_em"
    };

    const campoOrdenacao = camposOrdenacao[sort_by] || "criado_em";
    const direcao = sort_order === "asc" ? "ASC" : "DESC";

    const filtros = ["cliente_id = ?"];
    const params = [clientes_id];

    if (cnae) {
      filtros.push("cnae LIKE ?");
      params.push(`%${cnae}%`);
    }

    if (descricao) {
      filtros.push("descricao LIKE ?");
      params.push(`%${descricao}%`);
    }

    if (anexo) {
      filtros.push("anexo = ?");
      params.push(anexo);
    }

    const whereClause = filtros.length ? `WHERE ${filtros.join(" AND ")}` : "";

    const [rows] = await pool.query(
      `
        SELECT
          id,
          cliente_id AS clientes_id,
          cnae,
          descricao,
          anexo,
          fator_r,
          aliquota,
          criado_em AS created_at,
          criado_por AS created_by,
          NULL AS updated_at,
          atualizado_por AS updated_by
        FROM cnae_info
        ${whereClause}
        ORDER BY ${campoOrdenacao} ${direcao}
        LIMIT ?
        OFFSET ?
      `,
      [...params, limite, offset]
    );

    const [[countRow]] = await pool.query(
      `
        SELECT COUNT(*) AS total
        FROM cnae_info
        ${whereClause}
      `,
      params
    );

    res.json({
      data: rows || [],
      pagination: {
        page: pagina,
        limit: limite,
        total: countRow?.total || 0,
        total_pages: Math.ceil((countRow?.total || 0) / limite)
      }
    });
  } catch (err) {
    console.error("Erro interno ao buscar CNAE:", err);
    res.status(500).json({ error: "Erro interno do servidor." });
  }
});

// GET /cnae-info/:id - Buscar CNAE por ID
router.get("/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    const [rows] = await pool.query(
      `
        SELECT
          id,
          cliente_id AS clientes_id,
          cnae,
          descricao,
          anexo,
          fator_r,
          aliquota,
          criado_em AS created_at,
          criado_por AS created_by,
          NULL AS updated_at,
          atualizado_por AS updated_by
        FROM cnae_info
        WHERE id = ?
        LIMIT 1
      `,
      [id]
    );

    if (!rows.length) {
      return res.status(404).json({ error: "CNAE não encontrado." });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error("Erro ao buscar CNAE:", err);
    res.status(500).json({ error: "Erro interno do servidor." });
  }
});

// PUT /cnae-info/:id - Atualizar CNAE
router.put("/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      cnae,
      descricao,
      anexo,
      fator_r,
      aliquota
    } = req.body;

    if (!cnae || !descricao || !anexo || fator_r === undefined || aliquota === undefined) {
      return res.status(400).json({
        error: "Todos os campos são obrigatórios: cnae, descricao, anexo, fator_r, aliquota"
      });
    }

    const [existente] = await pool.query(
      `
        SELECT id, cliente_id
        FROM cnae_info
        WHERE id = ?
        LIMIT 1
      `,
      [id]
    );

    if (!existente.length) {
      return res.status(404).json({ error: "CNAE não encontrado." });
    }

    if (!req.user.company_id) {
      return res.status(403).json({ error: "Acesso negado." });
    }

    const [duplicado] = await pool.query(
      `
        SELECT id
        FROM cnae_info
        WHERE cliente_id = ?
          AND cnae = ?
          AND id <> ?
        LIMIT 1
      `,
      [existente[0].cliente_id, cnae, id]
    );

    if (duplicado.length) {
      return res.status(400).json({
        error: "CNAE já existe para esta empresa"
      });
    }

    await pool.query(
      `
        UPDATE cnae_info
        SET
          cnae = ?,
          descricao = ?,
          anexo = ?,
          fator_r = ?,
          aliquota = ?,
          atualizado_por = ?
        WHERE id = ?
      `,
      [cnae, descricao, anexo, fator_r, aliquota, req.user.userId, id]
    );

    const [atualizado] = await pool.query(
      `
        SELECT
          id,
          cliente_id AS clientes_id,
          cnae,
          descricao,
          anexo,
          fator_r,
          aliquota,
          criado_em AS created_at,
          criado_por AS created_by,
          NULL AS updated_at,
          atualizado_por AS updated_by
        FROM cnae_info
        WHERE id = ?
        LIMIT 1
      `,
      [id]
    );

    res.json(atualizado[0]);
  } catch (err) {
    console.error("Erro ao atualizar CNAE:", err);
    res.status(500).json({ error: "Erro interno do servidor." });
  }
});

// DELETE /cnae-info/:id - Deletar CNAE
router.delete("/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    const [existente] = await pool.query(
      `
        SELECT id, cliente_id
        FROM cnae_info
        WHERE id = ?
        LIMIT 1
      `,
      [id]
    );

    if (!existente.length) {
      return res.status(404).json({ error: "CNAE não encontrado." });
    }

    if (!req.user.company_id) {
      return res.status(403).json({ error: "Acesso negado." });
    }

    await pool.query(
      `
        DELETE FROM cnae_info
        WHERE id = ?
      `,
      [id]
    );

    res.json({ message: "CNAE deletado com sucesso." });
  } catch (err) {
    console.error("Erro ao deletar CNAE:", err);
    res.status(500).json({ error: "Erro interno do servidor." });
  }
});

module.exports = router;
