const express = require("express");
const pool = require("../../config/database");

const router = express.Router();

// Lista empresas com paginação simples simmmmmmmmmmmmmmmmmmmm
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
    const [rows] = await pool.query("SELECT * FROM empresas WHERE id = ?", [id]);
    if (rows.length === 0) return res.status(404).json({ error: "Empresa não encontrada." });
    res.json(rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao buscar empresa." });
  }
});

// Cria nova empresa
router.post("/", async (req, res) => {
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

    // Inicia transação para criar empresa e vínculos de módulos
    conn = await pool.getConnection();
    await conn.beginTransaction();

    const [result] = await conn.query(
      `INSERT INTO empresas (
        cnpj, nome, razaoSocial, cep, rua, bairro, estado, numero, complemento, cidade, status,
        cnae_primario, cnae_descricao, cnae_classe, data_fundacao, regime_tributario, optante_mei,
        inscricao_municipal, inscricao_estadual, tipo_empresa, pfx, senhaPfx, apiKey_ePlugin, logo_url,
        pesquisaSatisfacaoAtiva, onvioLogin, onvioSenha, onvioCodigoAutenticacao, onvioMfaSecret
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
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
      ]
    );

    // Vincular módulos, se enviados no body
    // Aceita: modulos: [1,2,3] ou modulos: [{modulo_id:1,status:'liberado'}]
    const { modulos } = payload;
    let values = [];
    if (!Array.isArray(modulos) || modulos.length === 0) {
      // Sem lista explícita: vincula todos os módulos existentes como 'bloqueado'
      const [allModules] = await conn.query("SELECT id FROM modulos");
      values = (allModules || []).map((m) => [result.insertId, m.id, "bloqueado"]);
    } else {
      // Lista explícita informada: usa somente a lista enviada
      for (const item of modulos) {
        if (item == null) continue;
        if (typeof item === "number") {
          values.push([result.insertId, item, "bloqueado"]);
        } else if (typeof item === "object" && item.modulo_id) {
          values.push([result.insertId, item.modulo_id, item.status || "bloqueado"]);
        }
      }
    }

    if (values.length > 0) {
      await conn.query(
        "INSERT INTO modulos_empresa (empresa_id, modulo_id, status) VALUES ?",
        [values]
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

module.exports = router;


