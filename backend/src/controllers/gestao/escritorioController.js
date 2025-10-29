const db = require("../../config/database");
const path = require("path");
const multer = require("multer");
const fs = require("fs");

// 📦 Configuração do Multer para salvar os certificados
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, "../storage/relatorios");
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});
const upload = multer({ storage: multer.memoryStorage() }); // Salva em memória

/**
 * 📌 Obtém os dados da empresa associada ao usuário autenticado
 */
const obterEscritorio = async (req, res) => {
  try {
    const usuarioId = req.usuario?.id;
    const empresaIdQuery = req.query.empresaId;

    if (!usuarioId && !empresaIdQuery) {
      return res.status(401).json({ error: "Usuário não autenticado." });
    }

    let empresaId = null;
    if (empresaIdQuery) {
      empresaId = empresaIdQuery;
    } else {
      // 🔎 Pega a empresa vinculada ao usuário
      const [relacao] = await db.query(
        "SELECT empresaId FROM relacao_empresas WHERE usuarioId = ?",
        [usuarioId]
      );
      if (relacao.length === 0) {
        return res.status(404).json({ error: "Nenhuma empresa vinculada ao usuário." });
      }
      empresaId = relacao[0].empresaId;
    }

    // 🔍 Busca os dados da empresa vinculada
    const [empresas] = await db.query("SELECT * FROM empresas WHERE id = ?", [empresaId]);

    if (empresas.length === 0) {
      return res.status(404).json({ error: "Escritório não encontrado." });
    }

    const empresa = empresas[0];
    
    // 🔓 Descriptografar senha do Onvio se existir (está em base64)
    if (empresa.onvioSenha) {
      try {
        empresa.onvioSenha = Buffer.from(empresa.onvioSenha, 'base64').toString();
      } catch (e) {
        // Se não conseguir descriptografar, mantém como está (pode ser que já esteja descriptografada)
      }
    }

    res.json(empresa);
  } catch (error) {
    console.error("❌ Erro ao buscar escritório:", error);
    res.status(500).json({ error: "Erro ao buscar escritório." });
  }
};


/**
 * 📌 Atualiza os dados de certificado digital do escritório já cadastrado
 */
const cadastrarEscritorio = async (req, res) => {
  try {
    upload.single("pfxCertificado")(req, res, async function (err) {
      if (err) {
        return res.status(400).json({ error: "Erro no upload do arquivo." });
      }

      const { senhaCertificado, apiKeyEplugin, empresaId } = req.body;
      const usuarioId = req.usuario.id;
      const pfxBase64 = req.file ? req.file.buffer.toString("base64") : null;

      // 🧠 Verificar se o usuário tem acesso à empresa específica
      const [relacao] = await db.query(
        "SELECT empresaId FROM relacao_empresas WHERE usuarioId = ? AND empresaId = ?",
        [usuarioId, empresaId]
      );

      if (relacao.length === 0) {
        return res.status(400).json({ error: "Usuário não tem acesso a esta empresa." });
      }

      // ✅ Atualizar apenas os campos do certificado na empresa
      await db.query(
        `UPDATE empresas 
         SET pfx = ?, senhaPfx = ?, apiKeyEplugin = ? 
         WHERE id = ?`,
        [pfxBase64, senhaCertificado, apiKeyEplugin, empresaId]
      );

      res.status(201).json({ message: "Certificado atualizado com sucesso!" });
    });
  } catch (error) {
    console.error("❌ Erro ao atualizar certificado:", error);
    res.status(500).json({ error: "Erro ao cadastrar escritório." });
  }
};

/**
 * 📌 Atualiza a logo da empresa vinculada ao usuário autenticado
 */
const atualizarLogoEmpresa = async (req, res) => {
  try {
    upload.single("logo")(req, res, async function (err) {
      if (err) {
        return res.status(400).json({ error: "Erro no upload do arquivo." });
      }
      const { empresaId } = req.body;
      const usuarioId = req.usuario.id;
      if (!req.file) return res.status(400).json({ error: "Arquivo não enviado." });
      
      // Verificar se o usuário tem acesso à empresa específica
      const [relacao] = await db.query(
        "SELECT empresaId FROM relacao_empresas WHERE usuarioId = ? AND empresaId = ?",
        [usuarioId, empresaId]
      );
      if (relacao.length === 0) {
        return res.status(400).json({ error: "Usuário não tem acesso a esta empresa." });
      }
      // Simulação de upload para Cloudinary/local: aqui salva como base64, mas pode ser adaptado
      const buffer = req.file.buffer;
      const base64 = buffer.toString("base64");
      const mimeType = req.file.mimetype;
      const logoUrl = `data:${mimeType};base64,${base64}`;
      await db.query(
        "UPDATE empresas SET logo_url = ? WHERE id = ?",
        [logoUrl, empresaId]
      );
      res.json({ ok: true, logo_url: logoUrl });
    });
  } catch (error) {
    console.error("❌ Erro ao atualizar logo da empresa:", error);
    res.status(500).json({ error: "Erro ao atualizar logo da empresa." });
  }
};

/**
 * 📌 Atualiza os dados básicos da empresa vinculada ao usuário autenticado
 */
const atualizarEscritorio = async (req, res) => {
  try {
    const { empresaId, apelido, site, email, telefone, instagram, facebook, cnpj } = req.body;
    if (!empresaId) {
      return res.status(400).json({ error: "empresaId não informado." });
    }
    await db.query(
      `UPDATE empresas SET apelido = ?, site = ?, email = ?, telefone = ?, instagram = ?, facebook = ?, cnpj = ? WHERE id = ?`,
      [apelido, site, email, telefone, instagram, facebook, cnpj, empresaId]
    );
    res.json({ success: true, message: "Dados da empresa atualizados com sucesso!" });
  } catch (error) {
    console.error("❌ Erro ao atualizar dados da empresa:", error);
    res.status(500).json({ error: "Erro ao atualizar dados da empresa." });
  }
};


module.exports = {
  obterEscritorio,
  cadastrarEscritorio,
  atualizarLogoEmpresa,
  atualizarEscritorio,
};
