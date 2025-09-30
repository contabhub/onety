const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const path = require("path");
const fs = require("fs");
const pool = require("../../config/database");
const { sendEmail } = require("../../config/email");

const router = express.Router();
const saltRounds = 10;

// Rota de registro de usuário (tabela: usuarios)
router.post("/register", async (req, res) => {
  const { nome, email, senha, telefone = null, avatar_url = null } = req.body;

  try {
    // Verifica se o usuário já existe
    const [existingUser] = await pool.query("SELECT id FROM usuarios WHERE email = ?", [email]);

    if (existingUser.length > 0) {
      return res.status(400).json({ error: "E-mail já cadastrado." });
    }

    // Criptografa a senha
    const hashedPassword = await bcrypt.hash(senha, saltRounds);

    // Insere o usuário no banco de dados
    await pool.query(
      "INSERT INTO usuarios (nome, email, senha, telefone, avatar_url, status) VALUES (?, ?, ?, ?, ?, 'ativo')",
      [nome, email, hashedPassword, telefone, avatar_url]
    );

    res.status(201).json({ message: "Usuário cadastrado com sucesso!" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao registrar usuário." });
  }
});

// Rota de login (tabela: usuarios)
router.post("/login", async (req, res) => {
  const { email, senha } = req.body;

  try {
    // Busca o usuário no banco de dados
    const [user] = await pool.query(
      `SELECT id, nome, email, senha, avatar_url, status FROM usuarios WHERE email = ? LIMIT 1`,
      [email]
    );

    if (user.length === 0) {
      return res.status(400).json({ error: "E-mail ou senha inválidos." });
    }

    const userData = user[0];

    // Verifica se o usuário está ativo
    if (userData.status && userData.status !== "ativo") {
      return res.status(403).json({ error: "Usuário inativo." });
    }

    // Verifica se a senha está correta
    const validPassword = await bcrypt.compare(senha, userData.senha);

    if (!validPassword) {
      return res.status(400).json({ error: "E-mail ou senha inválidos." });
    }

    // Carrega permissões e módulos do cargo do usuário (se houver vínculo)
    let permissoes = {};
    let permissoes_modulos = [];
    try {
      const [permRows] = await pool.query(
        `SELECT c.permissoes, c.permissoes_modulos
         FROM usuarios_empresas ue
         LEFT JOIN cargos c ON c.id = ue.cargo_id AND c.empresa_id = ue.empresa_id
         WHERE ue.usuario_id = ?
         ORDER BY ue.id DESC
         LIMIT 1`,
        [userData.id]
      );
      if (permRows.length) {
        if (permRows[0].permissoes) {
        permissoes = typeof permRows[0].permissoes === "string"
          ? JSON.parse(permRows[0].permissoes)
          : (permRows[0].permissoes || {});
        }
        if (permRows[0].permissoes_modulos) {
          permissoes_modulos = typeof permRows[0].permissoes_modulos === "string"
            ? JSON.parse(permRows[0].permissoes_modulos)
            : (permRows[0].permissoes_modulos || []);
        }
      }
    } catch (e) {
      permissoes = {};
      permissoes_modulos = [];
    }

    // Gera o token JWT incluindo permissões
    const token = jwt.sign(
      { id: userData.id, email: userData.email, permissoes, permissoes_modulos },
      process.env.JWT_SECRET,
      { expiresIn: "10h" }
    );

    // Retorna tudo que o frontend precisa (sem password_hash)
    res.json({
      token,
      user: {
        id: userData.id,
        email: userData.email,
        nome: userData.nome,
        avatar_url: userData.avatar_url,
        permissoes,
        permissoes_modulos
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao fazer login." });
  }
});


// Enviar código de redefinição
router.post("/requisitar-redefinicao-senha", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Informe o e-mail" });

  // Busca usuário
  const [user] = await pool.query("SELECT * FROM usuarios WHERE email = ?", [email]);
  // Sempre responde sucesso (não revela se existe ou não)
  if (!user.length) return res.status(200).json({ message: "Se o e-mail existir, o código será enviado." });

  // Gera código de 6 dígitos
  const code = Math.floor(100000 + Math.random() * 900000).toString();

  // Salva no banco
  await pool.query(
    "INSERT INTO redefinir_senha (email, codigo) VALUES (?, ?)",
    [email, code]
  );

  // 📧 Envia o e-mail de recuperação
  // Carrega a logo como base64
  const logoPath = path.join(__dirname, "../../assets/img/Logo-Onety.png");
  const logoBuffer = fs.readFileSync(logoPath);
  const logoBase64 = logoBuffer.toString("base64");
  
  await sendEmail(
    email,
    "Código de recuperação de senha - Onety",
    `Seu código para redefinir a senha é: ${code}\n\nUse este código para criar uma nova senha. Caso não tenha solicitado, ignore este e-mail.`,
    `
    <div style="font-family: Inter, 'Open Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <img src="data:image/png;base64,${logoBase64}" alt="Onety Logo" style="max-width: 200px; height: auto;">
      </div>
      
      <h1 style="color: #030842; text-align: center; font-size: 28px; font-weight: 600; margin-bottom: 20px;"> Recuperação de Senha</h1>
      
      <p style="color: #030842; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
        Você solicitou a redefinição da sua senha no Onety.
      </p>
      
      <div style="background: linear-gradient(135deg, #f8fafc 0%, #caf0f8 100%); padding: 20px; border-radius: 16px; margin: 20px 0; text-align: center; border: 1px solid #e1e4f2;">
        <h3 style="color: #030842; margin-top: 0; margin-bottom: 15px; font-size: 18px; font-weight: 500;">Seu código de acesso:</h3>
        <div style="background-color: #ffffff; padding: 20px; border: 2px solid #2E4AFF; border-radius: 8px; display: inline-block; min-width: 200px; box-shadow: 0px 4px 12px rgba(3, 8, 66, 0.15);">
          <span style="font-size: 24px; font-weight: bold; color: #2E4AFF; letter-spacing: 3px;">${code}</span>
        </div>
      </div>
      
      <p style="color: #030842; font-size: 14px; line-height: 1.6; margin-bottom: 20px;">
         <strong>Importante:</strong> Use este código para criar uma nova senha. Caso não tenha solicitado esta recuperação, ignore este e-mail.
      </p>
            
      <hr style="border: none; border-top: 1px solid #e1e4f2; margin: 30px 0;">
      
      <p style="color: #030842; font-size: 12px; text-align: center; opacity: 0.7;">
         Equipe Onety
      </p>
    </div>
    `
  );

  return res.status(200).json({ message: "Se o e-mail existir, o código será enviado." });
});


// Verificar se o código está correto
router.post("/verificar-codigo-redefinicao", async (req, res) => {
  const { email, codigo } = req.body;
  if (!email || !codigo) return res.status(400).json({ error: "Dados incompletos." });

  const [result] = await pool.query(
    "SELECT * FROM redefinir_senha WHERE email = ? AND codigo = ? AND usado = 0 ORDER BY criado_em DESC LIMIT 1",
    [email, codigo]
  );

  if (!result.length) return res.status(400).json({ error: "Código inválido." });

  res.status(200).json({ message: "Código válido." });
});

router.post("/redefinir-senha-com-codigo", async (req, res) => {
  const { email, codigo, newPassword, confirmPassword } = req.body;
  if (!email || !codigo || !newPassword || !confirmPassword) {
    return res.status(400).json({ error: "Preencha todos os campos." });
  }
  if (newPassword !== confirmPassword) {
    return res.status(400).json({ error: "As senhas não coincidem." });
  }

  // Verifica o código
  const [result] = await pool.query(
    "SELECT * FROM redefinir_senha WHERE email = ? AND codigo = ? AND usado = 0 ORDER BY criado_em DESC LIMIT 1",
    [email, codigo]
  );
  if (!result.length) return res.status(400).json({ error: "Código inválido." });

  // Atualiza senha
  const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
  await pool.query("UPDATE usuarios SET senha = ? WHERE email = ?", [hashedPassword, email]);

  // Marca o código como usado
  await pool.query("UPDATE redefinir_senha SET usado = 1 WHERE id = ?", [result[0].id]);

  res.status(200).json({ message: "Senha redefinida com sucesso!" });
});

module.exports = router;
