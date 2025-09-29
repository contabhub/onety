const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const pool = require("../../config/database");

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

    // Gera o token JWT
    const token = jwt.sign(
      { id: userData.id, email: userData.email },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    // Retorna tudo que o frontend precisa (sem password_hash)
    res.json({
      token,
      user: {
        id: userData.id,
        email: userData.email,
        nome: userData.nome,
        avatar_url: userData.avatar_url,
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao fazer login." });
  }
});


module.exports = router;
