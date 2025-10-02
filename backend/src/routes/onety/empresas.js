const express = require("express");
const pool = require("../../config/database");

const router = express.Router();

// Estatísticas de empresas para dashboard
router.get("/estatisticas", async (req, res) => {
  try {
    // Total de empresas
    const [totalEmpresas] = await pool.query("SELECT COUNT(*) as total FROM empresas");
    
    // Empresas ativas (status = 'ativo' ou similar)
    const [activeEmpresas] = await pool.query("SELECT COUNT(*) as ativas FROM empresas WHERE status = 'ativo'");
    
    // Empresas criadas recentemente (usando ID como proxy para data)
    const [recentEmpresas] = await pool.query(
      "SELECT COUNT(*) as recentes FROM empresas WHERE id > (SELECT MAX(id) - 10 FROM empresas)"
    );

    // Total de membros em todas as empresas
    const [totalMembros] = await pool.query(
      "SELECT COUNT(*) as membros FROM usuarios_empresas"
    );

    res.json({
      total: totalEmpresas[0]?.total || 0,
      ativas: activeEmpresas[0]?.ativas || 0,
      recentes: recentEmpresas[0]?.recentes || 0,
      membros: totalMembros[0]?.membros || 0
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao buscar estatísticas de empresas." });
  }
});

// Empresas recentes para dashboard
router.get("/recentes", async (req, res) => {
  try {
    const limit = Number(req.query.limit || 5);
    
    const [rows] = await pool.query(`
      SELECT 
        e.id,
        e.nome,
        e.criado_em,
        COUNT(ue.id) as funcionarios
      FROM empresas e
      LEFT JOIN usuarios_empresas ue ON e.id = ue.empresa_id
      GROUP BY e.id, e.nome, e.criado_em
      ORDER BY e.id DESC
      LIMIT ?
    `, [limit]);

    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao buscar empresas recentes." });
  }
});

// Lista empresas com paginação simples 
router.get("/", async (req, res) => {
  try {
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 20);
    const offset = (page - 1) * limit;

    const [rows] = await pool.query(
      "SELECT SQL_CALC_FOUND_ROWS * FROM empresas ORDER BY id DESC LIMIT ? OFFSET ?",
      [limit, offset]
    );
    const [countRows] = await pool.query("SELECT FOUND_ROWS() as total");

    res.json({
      data: rows,
      page,
      limit,
      total: countRows[0]?.total || 0,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao listar empresas." });
  }
});

// Busca empresa por ID
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.query(`
      SELECT e.*, 
             COUNT(ue.id) as membros
      FROM empresas e
      LEFT JOIN usuarios_empresas ue ON e.id = ue.empresa_id
      WHERE e.id = ?
      GROUP BY e.id
    `, [id]);
    if (rows.length === 0) return res.status(404).json({ error: "Empresa não encontrada." });
    res.json(rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao buscar empresa." });
  }
});

  // Cria nova empresa (apenas superadmin)
const verifyToken = require("../../middlewares/auth");
const { verificarPermissao } = require("../../middlewares/permissao");
router.post("/", verifyToken, verificarPermissao("adm.superadmin"), async (req, res) => {
  let conn;
  try {
    const payload = req.body || {};

    // Campos básicos mínimos — ajuste conforme seu esquema
    const {
      cnpj,
      nome,
      razaoSocial,
      cep,
      rua,
      bairro,
      estado,
      numero,
      complemento,
      cidade,
      status,
      cnae_primario,
      cnae_descricao,
      cnae_classe,
      data_fundacao,
      regime_tributario,
      optante_mei,
      inscricao_municipal,
      inscricao_estadual,
      tipo_empresa,
      pfx,
      senhaPfx,
      apiKey_ePlugin,
      logo_url,
      pesquisaSatisfacaoAtiva,
      onvioLogin,
      onvioSenha,
      onvioCodigoAutenticacao,
      onvioMfaSecret,
    } = payload;

    // Valida CNPJ único antes da transação
    if (cnpj) {
      const [exists] = await pool.query("SELECT id FROM empresas WHERE cnpj = ? LIMIT 1", [cnpj]);
      if (Array.isArray(exists) && exists.length > 0) {
        return res.status(409).json({ error: "CNPJ já cadastrado." });
      }
    }

    // Verificar se foi enviado admin_usuario_id (obrigatório)
    const { admin_usuario_id } = payload;
    if (!admin_usuario_id) {
      return res.status(400).json({ error: "Campo obrigatório: admin_usuario_id" });
    }

    // Verificar se o usuário existe
    const [usuarioExiste] = await pool.query("SELECT id FROM usuarios WHERE id = ?", [admin_usuario_id]);
    if (usuarioExiste.length === 0) {
      return res.status(400).json({ error: "Usuário não encontrado" });
    }

    // Inicia transação para criar empresa e vínculos de módulos
    conn = await pool.getConnection();
    await conn.beginTransaction();

    const [result] = await conn.query(
      `INSERT INTO empresas (
        cnpj, nome, razaoSocial, cep, rua, bairro, estado, numero, complemento, cidade, status,
        cnae_primario, cnae_descricao, cnae_classe, data_fundacao, regime_tributario, optante_mei,
        inscricao_municipal, inscricao_estadual, tipo_empresa, pfx, senhaPfx, apiKey_ePlugin, logo_url,
        pesquisaSatisfacaoAtiva, onvioLogin, onvioSenha, onvioCodigoAutenticacao, onvioMfaSecret, admin_usuario_id
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        cnpj,
        nome,
        razaoSocial,
        cep,
        rua,
        bairro,
        estado,
        numero,
        complemento,
        cidade,
        status,
        cnae_primario,
        cnae_descricao,
        cnae_classe,
        data_fundacao,
        regime_tributario,
        optante_mei,
        inscricao_municipal,
        inscricao_estadual,
        tipo_empresa,
        pfx,
        senhaPfx,
        apiKey_ePlugin,
        logo_url,
        pesquisaSatisfacaoAtiva,
        onvioLogin,
        onvioSenha,
        onvioCodigoAutenticacao,
        onvioMfaSecret,
        admin_usuario_id,
      ]
    );

    // Vincular módulos, se enviados no body
    // Aceita: modulos: [1,2,3] ou modulos: [{modulo_id:1,status:'liberado'}]
    const { modulos } = payload;
    let moduloValues = [];
    if (!Array.isArray(modulos) || modulos.length === 0) {
      // Sem lista explícita: vincula todos os módulos existentes como 'bloqueado'
      const [allModules] = await conn.query("SELECT id FROM modulos");
      moduloValues = (allModules || []).map((m) => [result.insertId, m.id, "bloqueado"]);
    } else {
      // Lista explícita informada: usa somente a lista enviada
      for (const item of modulos) {
        if (item == null) continue;
        if (typeof item === "number") {
          moduloValues.push([result.insertId, item, "bloqueado"]);
        } else if (typeof item === "object" && item.modulo_id) {
          moduloValues.push([result.insertId, item.modulo_id, item.status || "bloqueado"]);
        }
      }
    }

    if (moduloValues.length > 0) {
      await conn.query(
        "INSERT INTO modulos_empresa (empresa_id, modulo_id, status) VALUES ?",
        [moduloValues]
      );
    }

    // Vincular todos os grupos existentes como 'bloqueado'
    const [allGrupos] = await conn.query("SELECT id FROM grupos");
    if (allGrupos && allGrupos.length > 0) {
      const grupoValues = allGrupos.map((g) => [result.insertId, g.id, "bloqueado"]);
      await conn.query(
        "INSERT INTO empresas_grupos (empresa_id, grupo_id, status) VALUES ?",
        [grupoValues]
      );
    }

    // Vincular todos os conteúdos existentes como 'pendente'
    const [allConteudos] = await conn.query("SELECT id FROM conteudos");
    if (allConteudos && allConteudos.length > 0) {
      const conteudoValues = allConteudos.map((c) => [result.insertId, c.id, null, "pendente"]);
      await conn.query(
        "INSERT INTO empresas_conteudos (empresa_id, conteudo_id, usuario_id, status) VALUES ?",
        [conteudoValues]
      );
    }

    // Cria cargos padrão: Admin e Superadmin
    const [adminCargo] = await conn.query(
      `INSERT INTO cargos (nome, descricao, empresa_id, permissoes, permissoes_modulos)
       VALUES (?,?,?,?,?)`,
      [
        "Admin",
        "Administrador da empresa",
        result.insertId,
        JSON.stringify({ adm: ["admin"] }),
        JSON.stringify([]),
      ]
    );

    const [superAdminCargo] = await conn.query(
      `INSERT INTO cargos (nome, descricao, empresa_id, permissoes, permissoes_modulos)
       VALUES (?,?,?,?,?)`,
      [
        "Superadmin",
        "Acesso total ao sistema",
        result.insertId,
        JSON.stringify({ adm: ["superadmin"] }),
        JSON.stringify([]),
      ]
    );

    // Vincular o usuário 3 como SUPERADMIN (sempre)
    await conn.query(
      `INSERT INTO usuarios_empresas (usuario_id, empresa_id, cargo_id, departamento_id)
       VALUES (?,?,?,?)`,
      [3, result.insertId, superAdminCargo.insertId, null]
    );

    // Vincular o admin_usuario_id como ADMIN da empresa (cargo admin)
    await conn.query(
      `INSERT INTO usuarios_empresas (usuario_id, empresa_id, cargo_id, departamento_id)
       VALUES (?,?,?,?)`,
      [admin_usuario_id, result.insertId, adminCargo.insertId, null]
    );

    // Atualizar empresas_conteudos com o usuario_id do responsável (admin da empresa)
    if (allConteudos && allConteudos.length > 0) {
      await conn.query(
        "UPDATE empresas_conteudos SET usuario_id = ? WHERE empresa_id = ?",
        [admin_usuario_id, result.insertId]
      );
    }

    await conn.commit();

    const [created] = await pool.query("SELECT * FROM empresas WHERE id = ?", [result.insertId]);
    res.status(201).json({ ...created[0] });
  } catch (error) {
    console.error(error);
    if (conn) {
      try { await conn.rollback(); } catch (_) {}
    }
    res.status(500).json({ error: "Erro ao criar empresa." });
  } finally {
    if (conn) conn.release();
  }
});

// Atualiza empresa por ID (parcial - PATCH e também aceita PUT)
const buildUpdateQuery = (body) => {
  const allowed = [
    "cnpj",
    "nome",
    "razaoSocial",
    "cep",
    "rua",
    "bairro",
    "estado",
    "numero",
    "complemento",
    "cidade",
    
    "status",
    "cnae_primario",
    "cnae_descricao",
    "cnae_classe",
    "data_fundacao",
    "regime_tributario",
    "optante_mei",
    "inscricao_municipal",
    "inscricao_estadual",
    "tipo_empresa",
    "pfx",
    "senhaPfx",
    "apiKey_ePlugin",
    "logo_url",
    "pesquisaSatisfacaoAtiva",
    "onvioLogin",
    "onvioSenha",
    "onvioCodigoAutenticacao",
    "onvioMfaSecret",
  ];

  const fields = [];
  const values = [];
  for (const key of allowed) {
    if (Object.prototype.hasOwnProperty.call(body, key)) {
      fields.push(`${key} = ?`);
      values.push(body[key]);
    }
  }
  return { fields, values };
};

router.patch("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { fields, values } = buildUpdateQuery(req.body || {});
    if (fields.length === 0) return res.status(400).json({ error: "Nenhum campo para atualizar." });

    const sql = `UPDATE empresas SET ${fields.join(", ")} WHERE id = ?`;
    await pool.query(sql, [...values, id]);

    const [updated] = await pool.query("SELECT * FROM empresas WHERE id = ?", [id]);
    if (updated.length === 0) return res.status(404).json({ error: "Empresa não encontrada." });
    res.json(updated[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao atualizar empresa." });
  }
});

router.put("/:id", async (req, res) => {
  // Redireciona para a mesma lógica do PATCH
  req.method = "PATCH";
  return router.handle(req, res);
});

// Remove empresa por ID
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const [existing] = await pool.query("SELECT id FROM empresas WHERE id = ?", [id]);
    if (existing.length === 0) return res.status(404).json({ error: "Empresa não encontrada." });

    await pool.query("DELETE FROM empresas WHERE id = ?", [id]);
    res.status(204).send();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao remover empresa." });
  }
});

// Rota para vincular usuário como responsável por assistir uma empresa
router.post("/:empresa_id/vincular-responsavel", verifyToken, verificarPermissao("adm.superadmin"), async (req, res) => {
  let conn;
  try {
    const { empresa_id } = req.params;
    const { usuario_id } = req.body;

    if (!usuario_id) {
      return res.status(400).json({ error: "Campo obrigatório: usuario_id" });
    }

    // Verificar se a empresa existe
    const [empresa] = await pool.query("SELECT id FROM empresas WHERE id = ?", [empresa_id]);
    if (empresa.length === 0) {
      return res.status(404).json({ error: "Empresa não encontrada" });
    }

    // Verificar se o usuário existe
    const [usuario] = await pool.query("SELECT id FROM usuarios WHERE id = ?", [usuario_id]);
    if (usuario.length === 0) {
      return res.status(404).json({ error: "Usuário não encontrado" });
    }

    conn = await pool.getConnection();
    await conn.beginTransaction();

    // Atualizar todos os registros de empresas_conteudos para este usuário
    await conn.query(
      "UPDATE empresas_conteudos SET usuario_id = ? WHERE empresa_id = ?",
      [usuario_id, empresa_id]
    );

    await conn.commit();

    res.json({ 
      success: true, 
      message: `Usuário ${usuario_id} vinculado como responsável pela empresa ${empresa_id}` 
    });
  } catch (error) {
    console.error(error);
    if (conn) {
      try { await conn.rollback(); } catch (_) {}
    }
    res.status(500).json({ error: "Erro ao vincular responsável." });
  } finally {
    if (conn) conn.release();
  }
});

module.exports = router;


