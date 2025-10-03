const express = require("express");
const pool = require("../../config/database");

const router = express.Router();

// Middlewares de autenticação e permissão
const verifyToken = require("../../middlewares/auth");
const { verificarPermissao } = require("../../middlewares/permissao");

// Campos permitidos para update parcial
const ALLOWED_UPDATE_FIELDS = [
  "nome",
  "descricao", 
  "status",
  "departamento_global_id",
  "responsavel_id"
];

// Estatísticas de departamentos para dashboard
router.get("/estatisticas", async (req, res) => {
  try {
    // Total de departamentos
    const [totalDepartamentos] = await pool.query("SELECT COUNT(*) as total FROM departamentos");
    
    // Departamentos ativos
    const [activeDepartamentos] = await pool.query("SELECT COUNT(*) as ativos FROM departamentos WHERE status = 'ativo'");
      
    // Departamentos por empresa
    const [departamentosPorEmpresa] = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'ativo' THEN 1 END) as ativos
      FROM departamentos d
      JOIN empresas e ON d.empresa_id = e.id
    `);

    res.json({
      total: totalDepartamentos[0]?.total || 0,
      ativos: activeDepartamentos[0]?.ativos || 0,
      porEmpresa: departamentosPorEmpresa[0] || { total: 0, ativos: 0 }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao buscar estatísticas de departamentos." });
  }
});

// Lista departamentos com paginação e filtros
router.get("/", async (req, res) => {
  try {
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 20);
    const offset = (page - 1) * limit;
    const { empresa_id, status, search } = req.query;

    let whereClause = "1=1";
    let queryParams = [];

    // Filtro por empresa
    if (empresa_id) {
      whereClause += " AND d.empresa_id = ?";
      queryParams.push(empresa_id);
    }

    // Filtro por status
    if (status) {
      whereClause += " AND d.status = ?";
      queryParams.push(status);
    }

    // Filtro por busca (nome ou descrição)
    if (search) {
      whereClause += " AND (d.nome LIKE ? OR d.descricao LIKE ?)";
      const searchTerm = `%${search}%`;
      queryParams.push(searchTerm, searchTerm);
    }

    const [rows] = await pool.query(`
      SELECT 
        d.*,
        e.nome as empresa_nome,
        dg.nome as departamento_global_nome,
        u.nome as responsavel_nome,
        u.email as responsavel_email
      FROM departamentos d
      LEFT JOIN empresas e ON d.empresa_id = e.id
      LEFT JOIN departamentos_globais dg ON d.departamento_global_id = dg.id
      LEFT JOIN usuarios u ON d.responsavel_id = u.id
      WHERE ${whereClause}
      ORDER BY d.criado_em DESC
      LIMIT ? OFFSET ?
    `, [...queryParams, limit, offset]);

    // Contagem total para paginação
    const [countRows] = await pool.query(`
      SELECT COUNT(*) as total
      FROM departamentos d
      WHERE ${whereClause}
    `, queryParams);

    res.json({
      data: rows,
      page,
      limit,
      total: countRows[0]?.total || 0
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao listar departamentos." });
  }
});

// Busca departamento por ID
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    const [rows] = await pool.query(`
      SELECT 
        d.*,
        e.nome as empresa_nome,
        dg.nome as departamento_global_nome,
        u.nome as responsavel_nome,
        u.email as responsavel_email
      FROM departamentos d
      LEFT JOIN empresas e ON d.empresa_id = e.id
      LEFT JOIN departamentos_globais dg ON d.departamento_global_id = dg.id
      LEFT JOIN usuarios u ON d.responsavel_id = u.id
      WHERE d.id = ?
    `, [id]);

    if (rows.length === 0) {
      return res.status(404).json({ error: "Departamento não encontrado." });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao buscar departamento." });
  }
});

// Lista departamentos por empresa
router.get("/empresa/:empresa_id", async (req, res) => {
  try {
    const { empresa_id } = req.params;
    const { status } = req.query;

    let whereClause = "d.empresa_id = ?";
    let queryParams = [empresa_id];

    if (status) {
      whereClause += " AND d.status = ?";
      queryParams.push(status);
    }

    const [rows] = await pool.query(`
      SELECT 
        d.*,
        dg.nome as departamento_global_nome,
        u.nome as responsavel_nome,
        u.email as responsavel_email
      FROM departamentos d
      LEFT JOIN departamentos_globais dg ON d.departamento_global_id = dg.id
      LEFT JOIN usuarios u ON d.responsavel_id = u.id
      WHERE ${whereClause}
      ORDER BY d.nome ASC
    `, queryParams);

    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao listar departamentos da empresa." });
  }
});

// Cria novo departamento (requer autenticação e permissão)
router.post("/", verifyToken, verificarPermissao("adm.admin"), async (req, res) => {
  let conn;
  try {
    const {
      empresa_id,
      nome,
      descricao = null,
      status = "ativo",
      departamento_global_id = null,
      responsavel_id = null
    } = req.body || {};

    // Validações básicas
    if (!empresa_id || !nome) {
      return res.status(400).json({ 
        error: "Campos obrigatórios: empresa_id, nome." 
      });
    }

    // Verifica se a empresa existe
    const [empresaExists] = await pool.query(
      "SELECT id FROM empresas WHERE id = ?", 
      [empresa_id]
    );
    if (empresaExists.length === 0) {
      return res.status(404).json({ error: "Empresa não encontrada." });
    }

    // Verifica se o departamento global existe (se fornecido)
    if (departamento_global_id) {
      const [depGlobalExists] = await pool.query(
        "SELECT id FROM departamentos_globais WHERE id = ?", 
        [departamento_global_id]
      );
      if (depGlobalExists.length === 0) {
        return res.status(404).json({ error: "Departamento global não encontrado." });
      }
    }

    // Verifica se o responsável existe (se fornecido)
    if (responsavel_id) {
      const [responsavelExists] = await pool.query(
        "SELECT id FROM usuarios WHERE id = ?", 
        [responsavel_id]
      );
      if (responsavelExists.length === 0) {
        return res.status(404).json({ error: "Responsável não encontrado." });
      }
    }

    // Inicia transação
    conn = await pool.getConnection();
    await conn.beginTransaction();

    // Verifica se já existe departamento com mesmo nome na empresa
    const [nomeExists] = await conn.query(
      "SELECT id FROM departamentos WHERE empresa_id = ? AND nome = ?", 
      [empresa_id, nome]
    );
    if (nomeExists.length > 0) {
      await conn.rollback();
      return res.status(409).json({ 
        error: "Já existe um departamento com este nome nesta empresa." 
      });
    }

    const [result] = await conn.query(`
      INSERT INTO departamentos (
        empresa_id, nome, descricao, status, departamento_global_id, responsavel_id
      ) VALUES (?, ?, ?, ?, ?, ?)
    `, [empresa_id, nome, descricao, status, departamento_global_id, responsavel_id]);

    await conn.commit();

    // Retorna o departamento criado
    const [created] = await pool.query(`
      SELECT 
        d.*,
        e.nome as empresa_nome,
        dg.nome as departamento_global_nome,
        u.nome as responsavel_nome,
        u.email as responsavel_email
      FROM departamentos d
      LEFT JOIN empresas e ON d.empresa_id = e.id
      LEFT JOIN departamentos_globais dg ON d.departamento_global_id = dg.id
      LEFT JOIN usuarios u ON d.responsavel_id = u.id
      WHERE d.id = ?
    `, [result.insertId]);

    res.status(201).json(created[0]);
  } catch (error) {
    console.error(error);
    if (conn) {
      try { await conn.rollback(); } catch (_) {}
    }
    res.status(500).json({ error: "Erro ao criar departamento." });
  } finally {
    if (conn) conn.release();
  }
});

// Atualização parcial (PATCH) e total (PUT)
const buildUpdateQuery = (body) => {
  const fields = [];
  const values = [];

  for (const key of ALLOWED_UPDATE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(body, key)) {
      fields.push(`${key} = ?`);
      values.push(body[key]);
    }
  }

  return { fields, values };
};

router.patch("/:id", verifyToken, verificarPermissao("adm.admin"), async (req, res) => {
  try {
    const { id } = req.params;
    const { fields, values } = buildUpdateQuery(req.body || {});

    if (fields.length === 0) {
      return res.status(400).json({ error: "Nenhum campo para atualizar." });
    }

    // Verifica se o departamento existe
    const [existing] = await pool.query("SELECT id FROM departamentos WHERE id = ?", [id]);
    if (existing.length === 0) {
      return res.status(404).json({ error: "Departamento não encontrado." });
    }

    // Se está atualizando nome, verifica se não conflita com outro departamento da mesma empresa
    if (req.body.nome) {
      const [departamento] = await pool.query(
        "SELECT empresa_id FROM departamentos WHERE id = ?", 
        [id]
      );
      
      const [nomeExists] = await pool.query(
        "SELECT id FROM departamentos WHERE empresa_id = ? AND nome = ? AND id != ?", 
        [departamento[0].empresa_id, req.body.nome, id]
      );
      
      if (nomeExists.length > 0) {
        return res.status(409).json({ 
          error: "Já existe um departamento com este nome nesta empresa." 
        });
      }
    }

    // Validações para FKs se fornecidas
    if (req.body.departamento_global_id) {
      const [depGlobalExists] = await pool.query(
        "SELECT id FROM departamentos_globais WHERE id = ?", 
        [req.body.departamento_global_id]
      );
      if (depGlobalExists.length === 0) {
        return res.status(404).json({ error: "Departamento global não encontrado." });
      }
    }

    if (req.body.responsavel_id) {
      const [responsavelExists] = await pool.query(
        "SELECT id FROM usuarios WHERE id = ?", 
        [req.body.responsavel_id]
      );
      if (responsavelExists.length === 0) {
        return res.status(404).json({ error: "Responsável não encontrado." });
      }
    }

    const sql = `UPDATE departamentos SET ${fields.join(", ")} WHERE id = ?`;
    await pool.query(sql, [...values, id]);

    const [updated] = await pool.query(`
      SELECT 
        d.*,
        e.nome as empresa_nome,
        dg.nome as departamento_global_nome,
        u.nome as responsavel_nome,
        u.email as responsavel_email
      FROM departamentos d
      LEFT JOIN empresas e ON d.empresa_id = e.id
      LEFT JOIN departamentos_globais dg ON d.departamento_global_id = dg.id
      LEFT JOIN usuarios u ON d.responsavel_id = u.id
      WHERE d.id = ?
    `, [id]);

    res.json(updated[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao atualizar departamento." });
  }
});

router.put("/:id", verifyToken, verificarPermissao("adm.admin"), async (req, res) => {
  // Redireciona para a mesma lógica do PATCH
  req.method = "PATCH";
  return router.handle(req, res);
});

// Remove departamento por ID
router.delete("/:id", verifyToken, verificarPermissao("adm.admin"), async (req, res) => {
  try {
    const { id } = req.params;
    
    const [existing] = await pool.query("SELECT id FROM departamentos WHERE id = ?", [id]);
    if (existing.length === 0) {
      return res.status(404).json({ error: "Departamento não encontrado." });
    }

    // Verifica se há usuários vinculados ao departamento
    const [usuariosVinculados] = await pool.query(
      "SELECT COUNT(*) as total FROM usuarios_empresas WHERE departamento_id = ?", 
      [id]
    );
    
    if (usuariosVinculados[0]?.total > 0) {
      return res.status(409).json({ 
        error: "Não é possível excluir departamento com usuários vinculados. Transfira os usuários primeiro." 
      });
    }

    await pool.query("DELETE FROM departamentos WHERE id = ?", [id]);
    res.status(204).send();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao remover departamento." });
  }
});

// ==================== ROTAS PARA DEPARTAMENTOS GLOBAIS ====================

// Lista departamentos globais
router.get("/globais", async (req, res) => {
  try {
    const { search } = req.query;
    
    let whereClause = "1=1";
    let queryParams = [];

    // Filtro por busca (nome ou descrição)
    if (search) {
      whereClause += " AND (nome LIKE ? OR descricao LIKE ?)";
      const searchTerm = `%${search}%`;
      queryParams.push(searchTerm, searchTerm);
    }

    const [rows] = await pool.query(`
      SELECT 
        dg.*,
        COUNT(d.id) as total_departamentos_vinculados
      FROM departamentos_globais dg
      LEFT JOIN departamentos d ON dg.id = d.departamento_global_id
      WHERE ${whereClause}
      GROUP BY dg.id, dg.nome, dg.descricao, dg.criado_em, dg.atualizado_em
      ORDER BY dg.nome ASC
    `, queryParams);

    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao listar departamentos globais." });
  }
});

// Busca departamento global por ID
router.get("/globais/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    const [rows] = await pool.query(`
      SELECT 
        dg.*,
        COUNT(d.id) as total_departamentos_vinculados
      FROM departamentos_globais dg
      LEFT JOIN departamentos d ON dg.id = d.departamento_global_id
      WHERE dg.id = ?
      GROUP BY dg.id, dg.nome, dg.descricao, dg.criado_em, dg.atualizado_em
    `, [id]);

    if (rows.length === 0) {
      return res.status(404).json({ error: "Departamento global não encontrado." });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao buscar departamento global." });
  }
});

// Cria novo departamento global (apenas superadmin)
router.post("/globais", verifyToken, verificarPermissao("adm.superadmin"), async (req, res) => {
  try {
    const {
      nome,
      descricao = null
    } = req.body || {};

    // Validações básicas
    if (!nome) {
      return res.status(400).json({ 
        error: "Campo obrigatório: nome." 
      });
    }

    // Verifica se já existe departamento global com mesmo nome
    const [nomeExists] = await pool.query(
      "SELECT id FROM departamentos_globais WHERE nome = ?", 
      [nome]
    );
    if (nomeExists.length > 0) {
      return res.status(409).json({ 
        error: "Já existe um departamento global com este nome." 
      });
    }

    const [result] = await pool.query(`
      INSERT INTO departamentos_globais (nome, descricao)
      VALUES (?, ?)
    `, [nome, descricao]);

    // Retorna o departamento global criado
    const [created] = await pool.query(
      "SELECT * FROM departamentos_globais WHERE id = ?", 
      [result.insertId]
    );

    res.status(201).json(created[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao criar departamento global." });
  }
});

// Atualização parcial (PATCH) departamento global
router.patch("/globais/:id", verifyToken, verificarPermissao("adm.superadmin"), async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body || {};
    
    const allowedFields = ["nome", "descricao"];
    const fields = [];
    const values = [];

    for (const key of allowedFields) {
      if (Object.prototype.hasOwnProperty.call(body, key)) {
        fields.push(`${key} = ?`);
        values.push(body[key]);
      }
    }

    if (fields.length === 0) {
      return res.status(400).json({ error: "Nenhum campo para atualizar." });
    }

    // Verifica se o departamento global existe
    const [existing] = await pool.query("SELECT id FROM departamentos_globais WHERE id = ?", [id]);
    if (existing.length === 0) {
      return res.status(404).json({ error: "Departamento global não encontrado." });
    }

    // Se está atualizando nome, verifica se não conflita com outro departamento global
    if (body.nome) {
      const [nomeExists] = await pool.query(
        "SELECT id FROM departamentos_globais WHERE nome = ? AND id != ?", 
        [body.nome, id]
      );
      
      if (nomeExists.length > 0) {
        return res.status(409).json({ 
          error: "Já existe um departamento global com este nome." 
        });
      }
    }

    const sql = `UPDATE departamentos_globais SET ${fields.join(", ")} WHERE id = ?`;
    await pool.query(sql, [...values, id]);

    const [updated] = await pool.query(
      "SELECT * FROM departamentos_globais WHERE id = ?", 
      [id]
    );

    res.json(updated[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao atualizar departamento global." });
  }
});

// Remove departamento global por ID
router.delete("/globais/:id", verifyToken, verificarPermissao("adm.superadmin"), async (req, res) => {
  try {
    const { id } = req.params;
    
    const [existing] = await pool.query("SELECT id FROM departamentos_globais WHERE id = ?", [id]);
    if (existing.length === 0) {
      return res.status(404).json({ error: "Departamento global não encontrado." });
    }

    // Verifica se há departamentos vinculados ao departamento global
    const [departamentosVinculados] = await pool.query(
      "SELECT COUNT(*) as total FROM departamentos WHERE departamento_global_id = ?", 
      [id]
    );
    
    if (departamentosVinculados[0]?.total > 0) {
      return res.status(409).json({ 
        error: "Não é possível excluir departamento global com departamentos vinculados. Desvincule os departamentos primeiro." 
      });
    }

    await pool.query("DELETE FROM departamentos_globais WHERE id = ?", [id]);
    res.status(204).send();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao remover departamento global." });
  }
});

module.exports = router;
