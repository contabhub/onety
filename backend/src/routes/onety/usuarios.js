const express = require("express");
const bcrypt = require("bcryptjs");
const pool = require("../../config/database");

const router = express.Router();
const SALT_ROUNDS = 10;

// Campos permitidos para update parcial
const ALLOWED_UPDATE_FIELDS = [
  "nome",
  "email",
  "telefone",
  "avatar_url",
  "status",
  "preferencias",
  // senha é tratada separadamente para aplicar hash
];

// Lista usuários com paginação
router.get("/", async (req, res) => {
  try {
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 20);
    const offset = (page - 1) * limit;

    const [rows] = await pool.query(
      "SELECT SQL_CALC_FOUND_ROWS id, nome, email, telefone, avatar_url, criado_em, status, preferencias FROM usuarios ORDER BY id DESC LIMIT ? OFFSET ?",
      [limit, offset]
    );
    const [countRows] = await pool.query("SELECT FOUND_ROWS() as total");

    res.json({ data: rows, page, limit, total: countRows[0]?.total || 0 });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao listar usuários." });
  }
});

// Buscar por ID
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.query(
      "SELECT id, nome, email, telefone, avatar_url, criado_em, status, preferencias FROM usuarios WHERE id = ?",
      [id]
    );
    if (rows.length === 0) return res.status(404).json({ error: "Usuário não encontrado." });
    res.json(rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao buscar usuário." });
  }
});

// Criar usuário
router.post("/", async (req, res) => {
  try {
    const {
      nome,
      email,
      senha,
      telefone = null,
      avatar_url = null,
      status = "ativo",
      preferencias = null,
    } = req.body || {};

    if (!nome || !email || !senha) {
      return res.status(400).json({ error: "Campos obrigatórios: nome, email, senha." });
    }

    // Verifica e-mail único
    const [exists] = await pool.query("SELECT id FROM usuarios WHERE email = ?", [email]);
    if (exists.length > 0) return res.status(409).json({ error: "E-mail já cadastrado." });

    const senhaHash = await bcrypt.hash(String(senha), SALT_ROUNDS);

    const [result] = await pool.query(
      `INSERT INTO usuarios (nome, email, senha, telefone, avatar_url, status, preferencias)
       VALUES (?,?,?,?,?,?,?)`,
      [
        nome,
        email,
        senhaHash,
        telefone,
        avatar_url,
        status,
        preferencias == null ? null : JSON.stringify(preferencias),
      ]
    );

    const [created] = await pool.query(
      "SELECT id, nome, email, telefone, avatar_url, criado_em, status, preferencias FROM usuarios WHERE id = ?",
      [result.insertId]
    );
    res.status(201).json(created[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao criar usuário." });
  }
});

// Atualização parcial (PATCH) e total (PUT)
const buildUpdate = (body) => {
  const fields = [];
  const values = [];

  for (const key of ALLOWED_UPDATE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(body, key)) {
      fields.push(`${key} = ?`);
      if (key === "preferencias" && body[key] !== null && typeof body[key] === "object") {
        values.push(JSON.stringify(body[key]));
      } else {
        values.push(body[key]);
      }
    }
  }

  return { fields, values };
};

router.patch("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body || {};

    // Tratamento de senha (se vier no body)
    if (Object.prototype.hasOwnProperty.call(body, "senha")) {
      if (!body.senha) return res.status(400).json({ error: "Senha não pode ser vazia." });
      body.senha = await bcrypt.hash(String(body.senha), SALT_ROUNDS);
    }

    const { fields, values } = buildUpdate(body);

    if (Object.prototype.hasOwnProperty.call(body, "senha")) {
      fields.push("senha = ?");
      values.push(body.senha);
    }

    if (fields.length === 0) return res.status(400).json({ error: "Nenhum campo para atualizar." });

    const sql = `UPDATE usuarios SET ${fields.join(", ")} WHERE id = ?`;
    await pool.query(sql, [...values, id]);

    const [updated] = await pool.query(
      "SELECT id, nome, email, telefone, avatar_url, criado_em, status, preferencias FROM usuarios WHERE id = ?",
      [id]
    );
    if (updated.length === 0) return res.status(404).json({ error: "Usuário não encontrado." });
    res.json(updated[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao atualizar usuário." });
  }
});

router.put("/:id", async (req, res) => {
  // Redireciona para mesma lógica do PATCH
  req.method = "PATCH";
  return router.handle(req, res);
});

// Remover usuário
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const [existing] = await pool.query("SELECT id FROM usuarios WHERE id = ?", [id]);
    if (existing.length === 0) return res.status(404).json({ error: "Usuário não encontrado." });

    await pool.query("DELETE FROM usuarios WHERE id = ?", [id]);
    res.status(204).send();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao remover usuário." });
  }
});

module.exports = router;


