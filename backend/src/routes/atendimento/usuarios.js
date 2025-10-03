const express = require("express");
const router = express.Router();
const pool = require("../../config/database");
const bcrypt = require("bcryptjs");
const authOrApiKey = require("../../middlewares/authOrApiKey");
const multer = require("multer");
const cloudinary = require("../../config/cloudinary");
const sendEmail = require("../../services/onety/email");
const fs = require("fs");
const path = require("path");


// Configuração do multer para upload em memória
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Apenas arquivos de imagem são permitidos'), false);
    }
  }
});

/**
 * 📌 POST /users - Criar usuário (rota pública para registro)
 */
router.post("/", async (req, res) => {
  try {
    const { email, senha, nome, telefone, avatar_url } = req.body;

    if (!email || !senha || !nome) {
      return res.status(400).json({ error: "Campos obrigatórios: email, senha, nome" });
    }

    // 🔐 Criptografa a senha
    const hashedPassword = await bcrypt.hash(senha, 10);

    // 📝 Insere o usuário
    const [result] = await pool.query(
      `INSERT INTO usuarios (email, senha, nome, telefone, avatar_url) 
       VALUES (?, ?, ?, ?, ?)`,
      [email, hashedPassword, nome, telefone || null, avatar_url || null]
    );


    // 📧 Envia o e-mail de boas-vindas
    const logoPath = path.join(__dirname, "../assets/logo-aura8.png");
    const logoBuffer = fs.readFileSync(logoPath);
    const logoBase64 = logoBuffer.toString("base64");
    

    
    await sendEmail(
      email,
      "Bem-vindo ao Aura8!",
      `Olá ${nome},\n\nSua conta foi criada com sucesso!\n\n Seu acesso:\nUsuário: ${email}\nSenha: ${senha}\n\nRecomendamos alterar sua senha após o primeiro login.`,
      `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <img src="data:image/png;base64,${logoBase64}" alt="Aura8 Logo" style="max-width: 200px; height: auto;">
        </div>

        <h1 style="color: #8B5CF6; text-align: center;">Bem-vindo ao Aura8!</h1>

        <p style="color: #6b7280; font-size: 16px; line-height: 1.6;">
          Olá <strong>${nome}</strong>, sua conta foi criada com sucesso!
        </p>

        <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #1f2937; margin-top: 0;"> Seu acesso:</h3>
          <ul style="color: #1f2937; font-size: 16px;">
            <li><strong>Usuário:</strong> ${email}</li>
            <li><strong>Senha:</strong> ${senha}</li>
          </ul>
        </div>

        <p style="color: #6b7280; font-size: 14px;">
           <strong>Importante:</strong> Recomendamos alterar sua senha após o primeiro login.
        </p>

        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">

        <p style="color: #9ca3af; font-size: 12px; text-align: center;">
           Equipe Aura8
        </p>
      </div>
      `
    );

    res.status(201).json({ message: "Usuário cadastrado com sucesso e e-mail enviado!" });
  } catch (err) {
    console.error('Erro ao criar usuário:', err);
    res.status(500).json({ error: "Erro ao criar usuário." });
  }
});

/**
 * 📌 GET /users - Listar todos os usuários (protegida)
 */
router.get("/", authOrApiKey, async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT id, email, nome, telefone, avatar_url, criado_em FROM usuarios"
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Erro ao buscar usuários." });
  }
});

/**
 * 📌 GET /users/me - Buscar dados do usuário autenticado (protegida)
 */
router.get("/me", authOrApiKey, async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT id, email, nome, telefone, avatar_url, criado_em FROM usuarios WHERE id = ?", 
      [req.user.id]
    );

    if (rows.length === 0) return res.status(404).json({ error: "Usuário não encontrado." });
    res.json(rows[0]);
  } catch (err) {
    console.error('Erro ao buscar dados do usuário autenticado:', err);
    res.status(500).json({ error: "Erro ao buscar usuário." });
  }
});

/**
 * 📌 GET /users/:id - Buscar usuário por ID (protegida)
 */
router.get("/:id", authOrApiKey, async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT id, email, nome, telefone, avatar_url, criado_em FROM usuarios WHERE id = ?", 
      [req.params.id]
    );

    if (rows.length === 0) return res.status(404).json({ error: "Usuário não encontrado." });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Erro ao buscar usuário." });
  }
});

/**
 * 📌 PUT /users/:id - Atualizar dados (exceto senha) (protegida)
 */
router.put("/:id", authOrApiKey, async (req, res) => {
  try {
    const { email, nome, telefone, avatar_url } = req.body;

    if (!email || !nome) {
      return res.status(400).json({ error: "Campos obrigatórios: email, nome" });
    }

    await pool.query(
      "UPDATE usuarios SET email = ?, nome = ?, telefone = ?, avatar_url = ? WHERE id = ?",
      [email, nome, telefone || null, avatar_url || null, req.params.id]
    );

    res.json({ id: req.params.id, email, nome, telefone, avatar_url });
  } catch (err) {
    console.error('Erro ao atualizar usuário:', err);
    res.status(500).json({ error: "Erro ao atualizar usuário." });
  }
});

/**
 * 📌 DELETE /users/:id - Deletar usuário (protegida)
 */
router.delete("/:id", authOrApiKey, async (req, res) => {
  try {
    await pool.query("DELETE FROM usuarios WHERE id = ?", [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Erro ao deletar usuário." });
  }
});

/**
 * 📌 PUT /users/:id/avatar - Atualizar apenas o avatar (protegida)
 */
router.put("/:id/avatar", authOrApiKey, async (req, res) => {
  try {
    const { avatar_url } = req.body;
    if (!avatar_url) return res.status(400).json({ error: "avatar_url é obrigatório." });

    await pool.query(
      "UPDATE usuarios SET avatar_url = ? WHERE id = ?",
      [avatar_url, req.params.id]
    );

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Erro ao atualizar avatar." });
  }
});


/**
 * 📌 GET /users/company/:companyId - Listar usuários de uma empresa específica e indicar quem é o administrador principal
 */
router.get("/company/:companyId", authOrApiKey, async (req, res) => {
  try {
    const companyId = req.params.companyId;

    // 🔍 1️⃣ Buscar o admin principal da empresa
    const [company] = await pool.query(
      "SELECT admin_usuario_id FROM empresas WHERE id = ?",
      [companyId]
    );

    if (company.length === 0) {
      return res.status(404).json({ error: "Empresa não encontrada." });
    }

    const adminId = company[0].admin_usuario_id;

    // 🔍 2️⃣ Buscar todos os usuários vinculados a essa empresa
    const [users] = await pool.query(
      `SELECT 
         u.id, 
         u.email, 
         u.nome, 
         u.telefone, 
         u.avatar_url, 
         u.criado_em,
         uc.cargo_id,
         CASE WHEN u.id = ? THEN 1 ELSE 0 END AS is_admin
       FROM usuarios u
       INNER JOIN usuarios_empresas uc ON u.id = uc.usuario_id
       WHERE uc.empresa_id = ?`,
      [adminId, companyId]
    );

    // ✅ 3️⃣ Retornar os usuários com um flag "is_admin"
    res.json({
      company_id: companyId,
      admin_id: adminId,
      users
    });

  } catch (err) {
    console.error('Erro ao buscar usuários por empresa:', err);
    res.status(500).json({ error: "Erro ao buscar usuários desta empresa." });
  }
});


/**
 * 📌 GET /users/:id/teams - Listar os times em que o usuário participa
 */
/**
 * 📌 GET /users/:user_id/teams - Listar times de um usuário
 */
router.get("/:user_id/teams", authOrApiKey, async (req, res) => {
  try {
    const userId = req.params.user_id;

    const [rows] = await pool.query(`
      SELECT 
        t.id, 
        t.nome, 
        t.padrao, 
        t.empresa_id, 
        t.criado_em,
        tu.cargo_id
      FROM times_atendimento t
      INNER JOIN times_atendimento_usuarios tu ON tu.time_id = t.id
      WHERE tu.usuario_id = ?
    `, [userId]);

    res.json(rows);
  } catch (err) {
    console.error("Erro ao buscar times do usuário:", err);
    res.status(500).json({ error: "Erro ao buscar times do usuário." });
  }
});

/**
 * 📌 GET /users/:user_id/company/:company_id/teams - Listar times de um usuário filtrando por empresa
 */
router.get("/:user_id/company/:company_id/teams", authOrApiKey, async (req, res) => {
  try {
    const userId = req.params.user_id;
    const companyId = req.params.company_id;

    if (!userId || !companyId) {
      return res.status(400).json({ error: "Parâmetros obrigatórios: user_id e company_id." });
    }

    const [rows] = await pool.query(`
      SELECT 
        t.id,
        t.nome,
        t.padrao,
        t.empresa_id,
        t.criado_em,
        tu.cargo_id
      FROM times_atendimento t
      INNER JOIN times_atendimento_usuarios tu ON tu.time_id = t.id
      WHERE tu.usuario_id = ? AND t.empresa_id = ?
    `, [userId, companyId]);

    res.json(rows);
  } catch (err) {
    console.error("Erro ao buscar times do usuário por empresa:", err);
    res.status(500).json({ error: "Erro ao buscar times do usuário por empresa." });
  }
});

/**
 * 📌 POST /users/:id/upload-avatar - Upload de avatar para Cloudinary (protegida)
 */
router.post("/:id/upload-avatar", authOrApiKey, upload.single('avatar'), async (req, res) => {
  try {
    const userId = req.params.id;
    
    if (!req.file) {
      return res.status(400).json({ error: "Nenhum arquivo enviado." });
    }

    // Upload para Cloudinary
    const uploadResult = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        {
          resource_type: "image",
          folder: "aura8/avatar_url", // Organizar em pasta
          public_id: `avatar_${userId}_${Date.now()}`, // Nome único
          transformation: [
            { width: 200, height: 200, crop: "fill", gravity: "face" }, // Redimensionar e focar no rosto
            { quality: "auto", fetch_format: "auto" } // Otimização automática
          ]
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      ).end(req.file.buffer);
    });

    // Atualizar URL do avatar no banco de dados
    await pool.query(
      "UPDATE usuarios SET avatar_url = ? WHERE id = ?",
      [uploadResult.secure_url, userId]
    );

    res.json({ 
      success: true, 
      avatar_url: uploadResult.secure_url,
      public_id: uploadResult.public_id
    });

  } catch (err) {
    console.error('Erro ao fazer upload do avatar:', err);
    res.status(500).json({ error: "Erro ao fazer upload do avatar." });
  }
});


module.exports = router;
