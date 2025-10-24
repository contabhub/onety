const express = require("express");
const bcrypt = require("bcryptjs");
const pool = require("../../config/database");
const multer = require("multer");
const cloudinary = require("../../config/cloudinary");

const router = express.Router();
const SALT_ROUNDS = 10;

// Configuração de upload (memória) e filtro de imagens
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (allowed.includes(file.mimetype)) return cb(null, true);
    cb(new Error("Formato de arquivo inválido. Use JPG, PNG, WEBP ou GIF."));
  },
});

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

// Estatísticas de usuários para dashboard
router.get("/estatisticas", async (req, res) => {
  try {
    // Total de usuários (excluindo Superadmin)
    const [totalUsers] = await pool.query(`
      SELECT COUNT(DISTINCT u.id) as total 
      FROM usuarios u
      LEFT JOIN usuarios_empresas ue ON u.id = ue.usuario_id
      LEFT JOIN cargos c ON ue.cargo_id = c.id
      WHERE (c.nome IS NULL OR c.nome != 'Superadmin')
    `);
    
    // Usuários ativos (status = 'ativo', excluindo Superadmin)
    const [activeUsers] = await pool.query(`
      SELECT COUNT(DISTINCT u.id) as ativos 
      FROM usuarios u
      LEFT JOIN usuarios_empresas ue ON u.id = ue.usuario_id
      LEFT JOIN cargos c ON ue.cargo_id = c.id
      WHERE u.status = 'ativo' AND (c.nome IS NULL OR c.nome != 'Superadmin')
    `);
    
    // Usuários criados recentemente (usando ID como proxy para data, excluindo Superadmin)
    const [recentUsers] = await pool.query(`
      SELECT COUNT(DISTINCT u.id) as recentes 
      FROM usuarios u
      LEFT JOIN usuarios_empresas ue ON u.id = ue.usuario_id
      LEFT JOIN cargos c ON ue.cargo_id = c.id
      WHERE u.id > (SELECT MAX(id) - 10 FROM usuarios) AND (c.nome IS NULL OR c.nome != 'Superadmin')
    `);

    res.json({
      total: totalUsers[0]?.total || 0,
      ativos: activeUsers[0]?.ativos || 0,
      recentes: recentUsers[0]?.recentes || 0
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao buscar estatísticas de usuários." });
  }
});

// Usuários recentes para dashboard
router.get("/recentes", async (req, res) => {
  try {
    const limit = Number(req.query.limit || 5);
    
    const [rows] = await pool.query(`
      SELECT 
        u.id,
        u.nome,
        u.email,
        u.criado_em,
        COUNT(ue.empresa_id) as empresas
      FROM usuarios u
      LEFT JOIN usuarios_empresas ue ON u.id = ue.usuario_id
      LEFT JOIN cargos c ON ue.cargo_id = c.id
      WHERE (c.nome IS NULL OR c.nome != 'Superadmin')
      GROUP BY u.id, u.nome, u.email, u.criado_em
      ORDER BY u.id DESC
      LIMIT ?
    `, [limit]);
    
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao buscar usuários recentes." });
  }
});

// Empresas vinculadas a um usuário
router.get("/:id/empresas", async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ error: "ID do usuário é obrigatório." });

    const [rows] = await pool.query(
      `SELECT 
        e.id,
        e.nome,
        e.cnpj,
        e.logo_url,
        ue.cargo_id,
        ue.departamento_id,
        c.nome as cargo_nome,
        d.nome as departamento_nome
       FROM usuarios_empresas ue
       INNER JOIN empresas e ON e.id = ue.empresa_id
       LEFT JOIN cargos c ON ue.cargo_id = c.id
       LEFT JOIN departamentos d ON ue.departamento_id = d.id
       WHERE ue.usuario_id = ?
       ORDER BY e.nome ASC`,
      [id]
    );

    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao buscar empresas do usuário." });
  }
});


// Lista usuários com paginação
router.get("/", async (req, res) => {
  try {
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 20);
    const offset = (page - 1) * limit;

    // Query modificada para excluir usuários com cargo "Superadmin"
    const [rows] = await pool.query(`
      SELECT SQL_CALC_FOUND_ROWS DISTINCT u.id, u.nome, u.email, u.telefone, u.avatar_url, u.criado_em, u.status, u.preferencias 
      FROM usuarios u
      LEFT JOIN usuarios_empresas ue ON u.id = ue.usuario_id
      LEFT JOIN cargos c ON ue.cargo_id = c.id
      WHERE (c.nome IS NULL OR c.nome != 'Superadmin')
      ORDER BY u.id DESC 
      LIMIT ? OFFSET ?
    `, [limit, offset]);
    
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
    if (exists.length > 0) return res.status(409).json({ error: "Usuário já cadastrado." });

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

// Upload de avatar do usuário (Cloudinary)
router.patch("/:id/avatar", upload.single("avatar"), async (req, res) => {
  try {
    const { id } = req.params;

    // Valida existência do usuário
    const [existing] = await pool.query("SELECT id FROM usuarios WHERE id = ?", [id]);
    if (existing.length === 0) return res.status(404).json({ error: "Usuário não encontrado." });

    if (!req.file) return res.status(400).json({ error: "Arquivo 'avatar' é obrigatório." });

    // Upload para Cloudinary usando buffer
    const uploadResult = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: "onety/avatar_url",
          resource_type: "image",
          transformation: [{ width: 512, height: 512, crop: "limit" }],
        },
        (error, result) => {
          if (error) return reject(error);
          resolve(result);
        }
      );
      stream.end(req.file.buffer);
    });

    const avatarUrl = uploadResult?.secure_url;
    if (!avatarUrl) return res.status(500).json({ error: "Falha ao enviar imagem." });

    await pool.query("UPDATE usuarios SET avatar_url = ? WHERE id = ?", [avatarUrl, id]);

    const [updated] = await pool.query(
      "SELECT id, nome, email, telefone, avatar_url, criado_em, status, preferencias FROM usuarios WHERE id = ?",
      [id]
    );

    return res.json(updated[0]);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Erro ao atualizar avatar do usuário." });
  }
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


