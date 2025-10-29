const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../../config/database"); // Conexão com o banco
const JWT_SECRET = process.env.JWT_SECRET;
const crypto = require("crypto");
const emailService = require("../../services/gestao/emailService");


const getMe = async (req, res) => {
    try {
        const usuarioId = req.usuario.id;
        const [usuarios] = await db.query("SELECT id, nome, email FROM usuarios WHERE id = ?", [usuarioId]);

        if (usuarios.length === 0) {
            return res.status(404).json({ error: "Usuário não encontrado." });
        }

        res.json(usuarios[0]); // Retorna os dados do usuário autenticado
    } catch (error) {
        console.error("❌ Erro ao buscar usuário autenticado:", error);
        res.status(500).json({ error: "Erro ao buscar usuário." });
    }
};

const register = async (req, res) => {
    try {
        const { nome, email, senha, nivel = "usuario" } = req.body;

        if (!nome || !email || !senha) {
            return res.status(400).json({ error: "Todos os campos obrigatórios devem ser preenchidos." });
        }

        // Verificar se o usuário já existe
        const [existingUser] = await db.query("SELECT * FROM usuarios WHERE email = ?", [email]);
        if (existingUser.length > 0) {
            return res.status(400).json({ error: "Usuário já cadastrado." });
        }

        // Criptografar a senha
        const hashedSenha = await bcrypt.hash(senha, 10);

        // Inserir usuário sem CNPJ
        const [result] = await db.query(
            "INSERT INTO usuarios (nome, email, senha, nivel) VALUES (?, ?, ?, ?)",
            [nome, email, hashedSenha, nivel]
        );

        res.status(201).json({ message: "Usuário registrado com sucesso!", usuarioId: result.insertId });
    } catch (error) {
        console.error("❌ Erro ao registrar usuário:", error);
        res.status(500).json({ error: "Erro ao registrar usuário." });
    }
};

/**
 * 📌 Login de usuário (NÃO retorna mais token imediatamente)
 */
const login = async (req, res) => {
    try {
        const { email, senha } = req.body;
        const [usuarios] = await db.query(`
            SELECT * FROM usuarios WHERE email = ?
        `, [email]);

        if (usuarios.length === 0) {
            return res.status(401).json({ error: "Usuário não encontrado." });
        }

        const usuario = usuarios[0];
        const senhaValida = await bcrypt.compare(senha, usuario.senha);

        if (!senhaValida) {
            return res.status(401).json({ error: "Senha incorreta." });
        }

        // Buscar empresas vinculadas + cargoNome + tipo_empresa
        const [empresas] = await db.query(
            `SELECT e.id, e.razaoSocial as nome, e.tipo_empresa, c.nome as cargoNome
             FROM empresas e
             INNER JOIN relacao_empresas r ON r.empresaId = e.id
             LEFT JOIN cargos c ON r.cargoId = c.id
             WHERE r.usuarioId = ?`,
            [usuario.id]
        );

        res.json({
            usuario: {
                id: usuario.id,
                nome: usuario.nome,
                email: usuario.email,
                nivel: usuario.nivel,
                imagem: usuario.imagem || "/default-avatar.png"
            },
            empresas
        });
    } catch (error) {
        console.error("❌ Erro no login:", error);
        res.status(500).json({ error: "Erro ao realizar login." });
    }
};

/**
 * 📌 Gera token JWT após escolha da empresa
 */
const loginEmpresa = async (req, res) => {
    try {
        const { userId, empresaId } = req.body;

        // Valida se o usuário está vinculado à empresa
        const [relacao] = await db.query(
            "SELECT * FROM relacao_empresas WHERE usuarioId = ? AND empresaId = ?",
            [userId, empresaId]
        );
        if (!relacao.length) {
            return res.status(403).json({ error: "Usuário não vinculado à empresa." });
        }

        // Buscar dados do usuário
        const [usuarios] = await db.query("SELECT * FROM usuarios WHERE id = ?", [userId]);
        const usuario = usuarios[0];

        // Buscar empresa e tipo
        const [empresaRes] = await db.query("SELECT tipo_empresa FROM empresas WHERE id = ?", [empresaId]);
        const tipoEmpresa = empresaRes[0]?.tipo_empresa || 'franqueado';

        // Buscar cargo e permissões
        const [cargoRes] = await db.query(
            `SELECT c.id as cargoId, c.nome as cargoNome, c.permissoes
             FROM relacao_empresas re
             LEFT JOIN cargos c ON re.cargoId = c.id
             WHERE re.usuarioId = ? AND re.empresaId = ? LIMIT 1`,
            [userId, empresaId]
        );
        let cargoId = null, cargoNome = null, permissoes = {};
        if (cargoRes.length > 0) {
            cargoId = cargoRes[0].cargoId;
            cargoNome = cargoRes[0].cargoNome;
            if (cargoRes[0].permissoes) {
                if (typeof cargoRes[0].permissoes === "string") {
                    try {
                        permissoes = JSON.parse(cargoRes[0].permissoes);
                    } catch (e) {
                        permissoes = {};
                    }
                } else if (typeof cargoRes[0].permissoes === "object") {
                    permissoes = cargoRes[0].permissoes;
                }
            }
        }

        // Gera o token JWT com o empresaId correto
        // Configurar tempo de expiração do token (padrão: 8 horas)
        const tokenExpiration = process.env.JWT_EXPIRATION || "8h";
        
        const token = jwt.sign(
            {
                id: usuario.id,
                empresaId,
                nivel: usuario.nivel,
                cargoId,
                cargoNome,
                permissoes
            },
            JWT_SECRET,
            { expiresIn: tokenExpiration }
        );

        res.json({
            message: "Login realizado com sucesso!",
            token,
            usuario: {
                id: usuario.id,
                nome: usuario.nome,
                email: usuario.email,
                nivel: usuario.nivel,
                imagem: usuario.imagem || "/default-avatar.png",
                cargoId,
                cargoNome,
                permissoes
            },
            empresaId,
            tipoEmpresa
        });
    } catch (error) {
        console.error("❌ Erro no loginEmpresa:", error);
        res.status(500).json({ error: "Erro ao realizar login com empresa." });
    }
};

const alterarSenha = async (req, res) => {
    try {
        const { senhaAtual, novaSenha } = req.body;
        const usuarioId = req.usuario.id;

        // Buscar o usuário no banco de dados
        const [usuarios] = await db.query("SELECT * FROM usuarios WHERE id = ?", [usuarioId]);

        if (usuarios.length === 0) {
            return res.status(404).json({ error: "Usuário não encontrado." });
        }

        const usuario = usuarios[0];

        // Comparar a senha atual com a armazenada no banco
        const senhaValida = await bcrypt.compare(senhaAtual, usuario.senha);
        if (!senhaValida) {
            return res.status(401).json({ error: "Senha atual incorreta." });
        }

        // Criptografar a nova senha
        const hashedSenha = await bcrypt.hash(novaSenha, 10);

        // Atualizar a senha no banco de dados
        await db.query("UPDATE usuarios SET senha = ? WHERE id = ?", [hashedSenha, usuarioId]);

        res.json({ message: "Senha alterada com sucesso!" });
    } catch (error) {
        console.error("❌ Erro ao alterar senha:", error);
        res.status(500).json({ error: "Erro ao alterar senha." });
    }
};

/**
 * Solicita recuperação de senha
 */
const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ error: "E-mail é obrigatório." });
        const [usuarios] = await db.query("SELECT * FROM usuarios WHERE email = ?", [email]);
        if (usuarios.length === 0) {
            // Sempre responde sucesso para não expor se o e-mail existe
            return res.json({ message: "Se o e-mail existir, enviaremos instruções para redefinir a senha." });
        }
        const usuario = usuarios[0];
        const resetToken = crypto.randomBytes(32).toString("hex");
        const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1h
        await db.query("UPDATE usuarios SET resetToken = ?, resetTokenExpiry = ? WHERE id = ?", [resetToken, resetTokenExpiry, usuario.id]);
        await emailService.enviarEmailRecuperacaoSenha(usuario.email, usuario.nome, resetToken);
        return res.json({ message: "Se o e-mail existir, enviaremos instruções para redefinir a senha." });
    } catch (error) {
        console.error("❌ Erro no forgotPassword:", error);
        res.status(500).json({ error: "Erro ao solicitar recuperação de senha." });
    }
};

/**
 * Redefine a senha usando o token
 */
const resetPassword = async (req, res) => {
    try {
        const { token, novaSenha } = req.body;
        if (!token || !novaSenha) return res.status(400).json({ error: "Token e nova senha são obrigatórios." });
        const [usuarios] = await db.query("SELECT * FROM usuarios WHERE resetToken = ?", [token]);
        if (usuarios.length === 0) return res.status(400).json({ error: "Token inválido ou expirado." });
        const usuario = usuarios[0];
        if (!usuario.resetTokenExpiry || new Date(usuario.resetTokenExpiry) < new Date()) {
            return res.status(400).json({ error: "Token expirado. Solicite novamente." });
        }
        const hashedSenha = await bcrypt.hash(novaSenha, 10);
        await db.query("UPDATE usuarios SET senha = ?, resetToken = NULL, resetTokenExpiry = NULL WHERE id = ?", [hashedSenha, usuario.id]);
        return res.json({ message: "Senha redefinida com sucesso!" });
    } catch (error) {
        console.error("❌ Erro no resetPassword:", error);
        res.status(500).json({ error: "Erro ao redefinir senha." });
    }
};

module.exports = { register, login, getMe, alterarSenha, loginEmpresa, forgotPassword, resetPassword };
