const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const pool = require("../../config/database");

const router = express.Router();
const saltRounds = 10;

// Rota de registro de usuário
router.post("/register", async (req, res) => {
  const { email, password, full_name } = req.body;

  try {
    // Verifica se o usuário já existe
    const [existingUser] = await pool.query("SELECT * FROM users WHERE email = ?", [email]);

    if (existingUser.length > 0) {
      return res.status(400).json({ error: "E-mail já cadastrado." });
    }

    // Criptografa a senha
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Insere o usuário no banco de dados
    await pool.query(
      "INSERT INTO users (email, password_hash, full_name) VALUES (?, ?, ?)",
      [email, hashedPassword, full_name]
    );

    res.status(201).json({ message: "Usuário cadastrado com sucesso!" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao registrar usuário." });
  }
});

// Rota de login
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    // Busca o usuário no banco de dados
    const [user] = await pool.query(`
      SELECT 
        id, 
        email, 
        full_name,
        password_hash,
         avatar_url,
         role
      FROM users
      WHERE email = ?
    `, [email]);

    if (user.length === 0) {
      return res.status(400).json({ error: "E-mail ou senha inválidos." });
    }

    const userData = user[0];

    // Verifica se a senha está correta
    const validPassword = await bcrypt.compare(password, userData.password_hash);

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
        full_name: userData.full_name,
        avatar_url: userData.avatar_url,
        role: userData.role
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao fazer login." });
  }
});


module.exports = router;
