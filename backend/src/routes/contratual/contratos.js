const express = require("express");
const pool = require("../../config/database");
const verifyToken = require("../../middlewares/auth");
const sendEmail = require("../../services/onety/email");
const fs = require("fs");
const path = require("path");
const router = express.Router();
const crypto = require("crypto");
const PdfPrinter = require("pdfmake");
const htmlToPdfmake = require("html-to-pdfmake");
const { JSDOM } = require("jsdom");
const { PDFDocument } = require('pdf-lib');



// Criar um novo contrato (agora vinculado a um cliente e com múltiplos signatários)
router.post("/", verifyToken, async (req, res) => {
  const { template_id, client_id, validade_em_dias, signatories, variables, empresa_id, valor } = req.body;
  const createdBy = req.user.id;

  // Validação dos campos
  if (!template_id || !client_id || !Array.isArray(signatories) || signatories.length === 0 || !empresa_id) {
    return res.status(400).json({ error: "Preencha todos os campos obrigatórios." });
  }

  // Buscar conteúdo do template
  const [[template]] = await pool.query(
    "SELECT conteudo FROM modelos_contrato WHERE id = ?",
    [template_id]
  );

  if (!template) {
    return res.status(404).json({ error: "Template não encontrado." });
  }

  // Substituir as variáveis no conteúdo do template
  let filledContent = template.conteudo;
  variables.forEach(({ variable_name, value }) => {
    const regex = new RegExp(`{{\\s*${variable_name}\\s*}}`, "g");
    filledContent = filledContent.replace(regex, value);
  });

  // Usar data de expiração enviada pelo frontend
  const { expires_at, start_at, end_at } = req.body;


  if (!expires_at) {
    return res.status(400).json({ error: "O campo expires_at é obrigatório." });
  }

  try {
    // Criar o contrato com o conteúdo preenchido
    const [contractResult] = await pool.query(
      "INSERT INTO contratos (modelos_contrato_id, conteudo, status, criado_por, pre_cliente_id, expirado_em, comeca_em, termina_em, empresa_id, valor) VALUES (?, ?, 'pendente', ?, ?, ?, ?, ?, ?, ?)",
      [template_id, filledContent, createdBy, client_id, expires_at, start_at, end_at, empresa_id, valor]
    );

    const contract_id = contractResult.insertId;
    // Adicionar múltiplos signatários com tokens únicos
    for (const signatory of signatories) {
      const { name, email, cpf, birth_date, telefone, funcao_assinatura } = signatory;
      const access_token = crypto.randomBytes(32).toString("hex");
      // Trata string vazia e undefined como null
      const birthDateToSave = birth_date && birth_date.trim() !== "" ? birth_date : null;

      await pool.query(
        "INSERT INTO signatarios (contrato_id, nome, email, cpf, data_nascimento, token_acesso, telefone, empresa_id, funcao_assinatura) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [contract_id, name, email, cpf, birthDateToSave, access_token, telefone, empresa_id, funcao_assinatura]
      );
    }

    // Retornar a resposta de sucesso
    res.status(201).json({
      message: "Contrato criado com sucesso!",
      contract_id,
      expires_at: expires_at
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao criar contrato." });
  }
});

//rota da página de upload de contrato
router.post("/upload", verifyToken, async (req, res) => {
  const { content, signatories, empresa_id, expires_at, start_at, end_at, valor, client_id } = req.body;
  const createdBy = req.user.id;

  if (!content || !Array.isArray(signatories) || signatories.length === 0 || !empresa_id || !expires_at) {
    return res.status(400).json({ error: "Campos obrigatórios ausentes." });
  }

  try {
    const [contractResult] = await pool.query(
      `INSERT INTO contratos (conteudo, pdf_base64, status, criado_por, pre_cliente_id, expirado_em, comeca_em, termina_em, empresa_id, valor)
       VALUES (?, ?, 'pendente', ?, ?, ?, ?, ?, ?, ?)`,
      [content, content, createdBy, client_id, expires_at, start_at, end_at, empresa_id, valor || null]
    );


    const contract_id = contractResult.insertId;

    for (const signatory of signatories) {
      const { name, email, cpf, birth_date, telefone, funcao_assinatura } = signatory;
      const access_token = crypto.randomBytes(32).toString("hex");
      // Trata string vazia e undefined como null
      const birthDateToSave = birth_date && birth_date.trim() !== "" ? birth_date : null;

      await pool.query(
        "INSERT INTO signatarios (contrato_id, nome, email, cpf, data_nascimento, token_acesso, telefone, empresa_id, funcao_assinatura) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [contract_id, name, email, cpf, birthDateToSave, access_token, telefone, empresa_id, funcao_assinatura]
      );
    }


    res.status(201).json({ message: "Contrato via upload criado com sucesso!", contract_id });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao criar contrato via upload." });
  }
});



// Listar todos os contratos
router.get("/todos", verifyToken, async (req, res) => {
  try {
    const [contracts] = await pool.query(`
      SELECT c.*, cl.nome AS client_name,
       u.nome AS created_by
      FROM contratos c
      JOIN pre_clientes cl ON c.pre_cliente_id = cl.id
      JOIN usuarios u ON c.criado_por = u.id  -- Supondo que o "created_by" é o id do usuário

      ORDER BY c.criado_em DESC
    `);

    res.json(contracts);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao buscar contratos." });
  }
});

// Listar contratos filtrados pela empresa do usuário logado
router.get("/", verifyToken, async (req, res) => {
  const userId = req.user.id;  // ID do usuário autenticado

  try {
    // Obter o `empresa_id` da tabela `usuarios_empresas`
    const [userEmpresa] = await pool.query(
      "SELECT empresa_id FROM usuarios_empresas WHERE usuario_id = ?",
      [userId]
    );

    if (userEmpresa.length === 0) {
      return res.status(404).json({ error: "Usuário não está vinculado a nenhuma empresa." });
    }

    const empresaId = userEmpresa[0].empresa_id;

    console.log("📌 Usuário logado ID:", userId);
    console.log("📌 Empresa do usuário logado:", empresaId);

    // Buscar os contratos relacionados à empresa do usuário logado
    const [contracts] = await pool.query(`
      SELECT c.*, cl.nome AS client_name, u.nome AS created_by
      FROM contratos c
      JOIN pre_clientes cl ON c.pre_cliente_id = cl.id
      JOIN usuarios u ON c.criado_por = u.id
      WHERE c.empresa_id = ?  -- Filtra os contratos pela empresa do usuário logado
      ORDER BY c.criado_em DESC
    `, [empresaId]);

    if (contracts.length === 0) {
      console.log("📌 Nenhum contrato encontrado para esta empresa.");
      return res.status(404).json({ error: "Nenhum contrato encontrado para esta empresa." });
    }

    res.json(contracts);  // Retorna contratos filtrados pela empresa
  } catch (error) {
    console.error("Erro ao buscar contratos:", error);
    res.status(500).json({ error: "Erro ao buscar contratos." });
  }
});


router.get("/empresa/:id", verifyToken, async (req, res) => {
  const empresaId = parseInt(req.params.id, 10);
  const userId = req.user.id;

  // Verifica se o usuário pertence a essa empresa
  const [verifica] = await pool.query(
    "SELECT * FROM usuarios_empresas WHERE usuario_id = ? AND empresa_id = ?",
    [userId, empresaId]
  );
  if (verifica.length === 0) {
    return res.status(403).json({ error: "Você não tem acesso a essa empresa." });
  }

  // Buscar os contratos filtrados por empresa
  const [contracts] = await pool.query(`
    SELECT c.*, cl.nome AS client_name, u.nome AS created_by
    FROM contratos c
    LEFT JOIN pre_clientes cl ON c.pre_cliente_id = cl.id
    JOIN usuarios u ON c.criado_por = u.id
    WHERE c.empresa_id = ?
    ORDER BY c.criado_em DESC
  `, [empresaId]);

  res.json(contracts);
});

// Listar contratos de uma empresa (LIGHT: sem content/pdf_base64/assinatura_base64)
router.get("/empresa/:id/light", verifyToken, async (req, res) => {
  try {
    const empresaId = Number(req.params.id) || 0;
    const userId = req.user.id;

    // segurança: usuário pertence à empresa?
    const [vinculo] = await pool.query(
      "SELECT 1 FROM usuarios_empresas WHERE usuario_id = ? AND empresa_id = ? LIMIT 1",
      [userId, empresaId]
    );
    if (vinculo.length === 0) {
      return res.status(403).json({ error: "Você não tem acesso a essa empresa." });
    }

    // consulta leve (sem campos longtext) e com JOIN no usuarios para trazer o NOME
    const [contracts] = await pool.query(
      `
      SELECT
        c.id,
        c.modelos_contrato_id,
        c.status,
        c.autentique,
        c.autentique_id,
        u.id         AS created_by_id,
        u.nome  AS created_by,      -- << nome do responsável
        c.criado_em,
        c.expirado_em,
        c.pre_cliente_id,
        cl.nome      AS client_name,
        c.comeca_em,
        c.termina_em,
        c.empresa_id,
        c.rejeitado_por,
        c.valor,
        c.valor_recorrente
      FROM contratos c
      INNER JOIN usuarios  u  ON u.id = c.criado_por      -- usuarios: id, nome, ...
      LEFT  JOIN pre_clientes cl ON cl.id = c.pre_cliente_id     -- se existir a tabela pre_clientes
      WHERE c.empresa_id = ?
      ORDER BY c.criado_em DESC
      `,
      [empresaId]
    );

    return res.json(contracts);
  } catch (error) {
    console.error("Erro ao buscar contratos (light):", error);
    return res.status(500).json({ error: "Erro ao buscar contratos." });
  }
});



// Obter um contrato por ID
router.get("/:id", verifyToken, async (req, res) => {
  const { id } = req.params;

  try {
    // 1️⃣ Buscar informações básicas do contrato + cliente vinculado
    const [contract] = await pool.query(
      `SELECT c.*, cl.nome as client_name, cl.cpf_cnpj, cl.email as client_email, cl.telefone, cl.endereco, sr.nome AS rejected_by_name
       FROM contratos c
      LEFT JOIN pre_clientes cl ON c.pre_cliente_id = cl.id
       LEFT JOIN signatarios sr ON c.rejeitado_por = sr.id
       WHERE c.id = ?`,
      [id]
    );

    if (contract.length === 0) {
      return res.status(404).json({ error: "Contrato não encontrado." });
    }

    // 2️⃣ Buscar signatários do contrato
    const [signatories] = await pool.query(
      `SELECT id, nome, email, cpf, data_nascimento, assinado_em, token_acesso 
       FROM signatarios WHERE contrato_id = ?`,
      [id]
    );

    // 3️⃣ Buscar assinaturas do contrato
    const [signatures] = await pool.query(
      `SELECT s.id, s.cpf, s.assinado_em, s.endereco_ip, s.navegador_usuario, s.hash, si.nome as signatory_name
       FROM assinaturas s
       JOIN signatarios si ON s.signatario_id = si.id
       WHERE s.contrato_id = ?`,
      [id]
    );



    res.json({
      contract: contract[0],
      signatories,
      signatures,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao buscar contrato." });
  }
});


// Atualizar um contrato
router.put("/:id", verifyToken, async (req, res) => {
  const { id } = req.params;
  const { content, status, expires_at } = req.body;

  try {
    const [contract] = await pool.query("SELECT status FROM contratos WHERE id = ?", [id]);

    if (contract.length === 0) {
      return res.status(404).json({ error: "Contrato não encontrado." });
    }

    if (contract[0].status === "assinado") {
      return res.status(403).json({ error: "Contrato já foi assinado e não pode ser modificado." });
    }

    await pool.query(
      "UPDATE contratos SET conteudo = ?, status = ?, expirado_em = ? WHERE id = ?",
      [content, status, expires_at, id]
    );

    res.json({ message: "Contrato atualizado com sucesso!" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao atualizar contrato." });
  }
});


// Deletar um contrato
router.delete("/:id", verifyToken, async (req, res) => {
  const { id } = req.params;

  try {
    await pool.query("DELETE FROM contratos WHERE id = ?", [id]);
    res.json({ message: "Contrato deletado com sucesso!" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao deletar contrato." });
  }
});

// Enviar e-mails para signatários (agora usando seus tokens únicos)
router.post("/:id/send-email", verifyToken, async (req, res) => {
  const { id } = req.params;
  try {
    // Buscar signatários do contrato
    const [signatories] = await pool.query(
      "SELECT email, token_acesso, nome FROM signatarios WHERE contrato_id = ?",
      [id]
    );

    if (signatories.length === 0) {
      return res.status(404).json({ error: "Nenhum signatário encontrado para este contrato." });
    }

    // Buscar contrato para verificar se é do Autentique
    const [contracts] = await pool.query(
      "SELECT autentique FROM contratos WHERE id = ?",
      [id]
    );

    if (contracts.length === 0) {
      return res.status(404).json({ error: "Contrato não encontrado." });
    }

    const isAutentique = contracts[0].autentique === 1;

    // 📧 Enviar e-mail para cada signatário com seu link exclusivo
    // Carrega a logo como base64
    const logoPath = path.join(__dirname, "../../assets/img/Logo-Onety.png");
    const logoBuffer = fs.readFileSync(logoPath);
    const logoBase64 = logoBuffer.toString("base64");

    for (const { email, token_acesso, nome } of signatories) {
      // Se for do Autentique, usar o token_acesso diretamente (que é o link do Autentique)
      // Se não for do Autentique, usar o link do frontend
      const contractLink = isAutentique ? token_acesso : `https://frontend-contract-flow.vercel.app/contratual/assinar/${token_acesso}`;

      const emailSent = await sendEmail(
        email,
        " Documento para assinatura - ContractFlow",
        `Olá,\n\nVocê tem um documento aguardando sua assinatura.\n\nAcesse o link para assinar: ${contractLink}\n\nEste link é exclusivo e seguro para você.`,
        `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <img src="data:image/png;base64,${logoBase64}" alt="ContractFlow Logo" style="max-width: 200px; height: auto;">
          </div>
          
          <h1 style="color: #333; text-align: center;"> Documento para Assinatura</h1>
          
          <p style="color: #555; font-size: 16px; line-height: 1.6;">
            Olá, você tem um documento aguardando sua assinatura.
          </p>
          
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #333; margin-top: 0; margin-bottom: 15px;"> Documento Pendente</h3>
            <p style="color: #555; font-size: 16px; margin-bottom: 15px;">
              Um documento foi enviado para sua assinatura através da plataforma ContractFlow.
            </p>
            <p style="color: #666; font-size: 14px; margin: 0;">
              Clique no botão abaixo para acessar e assinar o documento.
            </p>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${contractLink}" style="background-color: #007bff; color: white; padding: 15px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
               Assinar Documento
            </a>
          </div>
          
          <div style="background-color: #e7f3ff; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #007bff;">
            <p style="color: #004085; font-size: 14px; margin: 0;">
              <strong> Segurança:</strong> Este link é exclusivo e seguro para você.<br>
              <strong> Prazo:</strong> Recomendamos assinar o quanto antes.<br>
              <strong> Compatível:</strong> Funciona em computadores e dispositivos móveis.
            </p>
          </div>
          
          <p style="color: #666; font-size: 14px;">
            Se o botão não funcionar, copie e cole este link no seu navegador:<br>
            <a href="${contractLink}" style="color: #007bff; word-break: break-all;">${contractLink}</a>
          </p>
          
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          
          <p style="color: #888; font-size: 12px; text-align: center;">
            Empresa ContractFlow
          </p>
        </div>
        `
      );

      if (!emailSent) {
        console.error(`Erro ao enviar e-mail para: ${email}`);
      }
    }

    res.json({ message: "E-mails enviados com sucesso!" });
  } catch (error) {
    console.error("Erro ao enviar e-mails:", error);
    res.status(500).json({ error: "Erro ao enviar e-mails." });
  }
});


// Buscar contrato por access_token de um signatário
router.get("/token/:access_token", async (req, res) => {
  const { access_token } = req.params;

  try {
    const [signatory] = await pool.query(
      `SELECT s.*, c.id AS contract_id, c.conteudo, c.status, c.expirado_em, c.rejeitado_por, sr.nome AS rejected_by_name
       FROM signatarios s
       JOIN contratos c ON s.contrato_id = c.id
       LEFT JOIN signatarios sr ON c.rejeitado_por = sr.id
       WHERE s.token_acesso = ? AND c.expirado_em > NOW()`,
      [access_token]
    );

    if (signatory.length === 0) {
      return res.status(400).json({ error: "Link expirado ou contrato não encontrado." });
    }

    res.json(signatory[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao buscar contrato." });
  }
});

// Rota para obter o contrato assinado pelo hash
router.get("/token/:access_token/signed", async (req, res) => {
  const { access_token } = req.params;

  try {
    // Buscar o contrato pelo hash e verificar se ele já está assinado
    const [contract] = await pool.query(
      "SELECT * FROM contratos WHERE token_acesso = ? AND status = 'assinado'",
      [access_token]
    );

    if (contract.length === 0) {
      return res.status(404).json({ error: "Contrato não encontrado ou ainda não assinado." });
    }

    res.json(contract[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao buscar contrato assinado." });
  }
});


// Buscar signatários de um contrato
router.get("/:id/signatories", verifyToken, async (req, res) => {
  const { id } = req.params;
  try {
    const [signatories] = await pool.query("SELECT * FROM signatarios WHERE contrato_id = ?", [id]);
    res.json(signatories);
  } catch (error) {
    res.status(500).json({ error: "Erro ao buscar signatários." });
  }
});

// Buscar assinaturas do contrato
router.get("/:id/signatures", async (req, res) => {
  const { id } = req.params;
  try {
    const [signatures] = await pool.query(
      `SELECT s.id, s.contrato_id, s.cpf, s.assinado_em, s.endereco_ip, s.navegador_usuario, s.hash, 
              si.id AS signatory_id, si.nome, si.email
       FROM assinaturas s
       JOIN signatarios si ON s.signatario_id = si.id
       WHERE s.contrato_id = ?`,
      [id]
    );

    if (signatures.length === 0) {
      return res.status(404).json({ error: "Nenhuma assinatura encontrada para este contrato." });
    }

    res.json(signatures);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao buscar assinaturas." });
  }
});


// Atualizar apenas o status do contrato
router.patch("/:id/status", verifyToken, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!status) {
    return res.status(400).json({ error: "Status é obrigatório." });
  }

  try {
    const [contract] = await pool.query("SELECT status FROM contratos WHERE id = ?", [id]);

    if (contract.length === 0) {
      return res.status(404).json({ error: "Contrato não encontrado." });
    }

    if (contract[0].status === "assinado") {
      return res.status(403).json({ error: "Contrato já foi assinado e não pode ser modificado." });
    }

    await pool.query("UPDATE contratos SET status = ? WHERE id = ?", [status, id]);

    res.json({ message: "Status atualizado com sucesso!" });
  } catch (error) {
    console.error("Erro ao atualizar status do contrato:", error);
    res.status(500).json({ error: "Erro ao atualizar status do contrato." });
  }
});



router.get("/:id/download", verifyToken, async (req, res) => {
  const { id } = req.params;

  try {
    const [[contract]] = await pool.query(
      "SELECT pdf_base64, assinatura_base64 FROM contratos WHERE id = ?",
      [id]
    );

    if (!contract?.pdf_base64 || !contract?.assinatura_base64) {
      return res.status(404).json({ error: "PDFs não encontrados para este contrato." });
    }

    // Junta os dois PDFs!
    const contratoBuffer = Buffer.from(contract.pdf_base64, 'base64');
    const assinaturaBuffer = Buffer.from(contract.assinatura_base64, 'base64');

    // Carrega PDFs com pdf-lib
    const contratoPdf = await PDFDocument.load(contratoBuffer);
    const assinaturaPdf = await PDFDocument.load(assinaturaBuffer);

    // Cria novo PDF e copia as páginas dos dois
    const mergedPdf = await PDFDocument.create();
    const contratoPages = await mergedPdf.copyPages(contratoPdf, contratoPdf.getPageIndices());
    contratoPages.forEach(page => mergedPdf.addPage(page));
    const assinaturaPages = await mergedPdf.copyPages(assinaturaPdf, assinaturaPdf.getPageIndices());
    assinaturaPages.forEach(page => mergedPdf.addPage(page));

    // Salva o PDF final em base64
    const mergedBytes = await mergedPdf.save();
    const base64Final = Buffer.from(mergedBytes).toString('base64');

    res.json({
      message: "PDF final combinado gerado com sucesso.",
      base64: base64Final,
    });

  } catch (error) {
    console.error("❌ Erro ao recuperar base64 combinado:", error);
    res.status(500).json({ error: "Erro ao recuperar o base64 combinado." });
  }
});



router.get("/:id/download-assinado", async (req, res) => {
  const { id } = req.params;

  try {
    const [[contract]] = await pool.query(
      "SELECT pdf_base64, assinatura_base64 FROM contratos WHERE id = ?",
      [id]
    );

    if (!contract?.pdf_base64 || !contract?.assinatura_base64) {
      return res.status(404).json({ error: "PDFs não encontrados para este contrato." });
    }

    // Junta os dois PDFs!
    const contratoBuffer = Buffer.from(contract.pdf_base64, 'base64');
    const assinaturaBuffer = Buffer.from(contract.assinatura_base64, 'base64');

    // Carrega PDFs com pdf-lib
    const contratoPdf = await PDFDocument.load(contratoBuffer);
    const assinaturaPdf = await PDFDocument.load(assinaturaBuffer);

    // Cria novo PDF e copia as páginas dos dois
    const mergedPdf = await PDFDocument.create();
    const contratoPages = await mergedPdf.copyPages(contratoPdf, contratoPdf.getPageIndices());
    contratoPages.forEach(page => mergedPdf.addPage(page));
    const assinaturaPages = await mergedPdf.copyPages(assinaturaPdf, assinaturaPdf.getPageIndices());
    assinaturaPages.forEach(page => mergedPdf.addPage(page));

    // Salva o PDF final em base64
    const mergedBytes = await mergedPdf.save();
    const base64Final = Buffer.from(mergedBytes).toString('base64');

    res.json({
      message: "PDF final combinado gerado com sucesso.",
      base64: base64Final,
    });

  } catch (error) {
    console.error("❌ Erro ao recuperar base64 combinado:", error);
    res.status(500).json({ error: "Erro ao recuperar o base64 combinado." });
  }
});


// Verificar se o signatário já assinou (sem substituir rota existente)
router.get("/token/:access_token/check-signature", async (req, res) => {
  const { access_token } = req.params;

  try {
    // 1. Buscar o signatário pelo token
    const [[signatory]] = await pool.query(
      `SELECT * FROM signatarios WHERE token_acesso = ?`,
      [access_token]
    );

    if (!signatory) {
      return res.status(404).json({ error: "Signatário não encontrado." });
    }

    // 2. Verificar se existe assinatura
    const [[signature]] = await pool.query(
      `SELECT * FROM assinaturas WHERE signatario_id = ?`,
      [signatory.id]
    );

    if (!signature) {
      return res.status(404).json({ error: "Este signatário ainda não assinou." });
    }

    // 3. Buscar o contrato associado
    const [[contract]] = await pool.query(
      `SELECT id, conteudo, status, expirado_em FROM contratos WHERE id = ?`,
      [signatory.contrato_id]
    );

    return res.json({
      ...signatory,
      contract_id: contract.id,
      conteudo: contract.conteudo,
      status: contract.status,
      expirado_em: contract.expirado_em,
    });
  } catch (error) {
    console.error("❌ Erro ao verificar assinatura:", error);
    res.status(500).json({ error: "Erro ao verificar assinatura." });
  }
});

// Enviar notificação por e-mail ao criador quando o contrato for rejeitado
router.post("/:id/notificar-rejeicao", async (req, res) => {
  const { id } = req.params;

  try {
    // Buscar contrato + criador + quem rejeitou
    const [[contract]] = await pool.query(`
      SELECT c.id, c.status, c.rejeitado_por, 
             u.email AS creator_email, u.nome AS creator_name,
             sr.nome AS rejected_by_name
      FROM contratos c
      JOIN usuarios u ON c.criado_por = u.id
      LEFT JOIN signatarios sr ON c.rejeitado_por = sr.id
      WHERE c.id = ?
    `, [id]);

    if (!contract) {
      return res.status(404).json({ error: "Contrato não encontrado." });
    }

    if (!contract.rejeitado_por) {
      return res.status(400).json({ error: "Este contrato ainda não foi rejeitado." });
    }

    // 📧 Envia o e-mail de notificação de rejeição
    // Carrega a logo como base64
    const logoPath = path.join(__dirname, "../../assets/img/Logo-Onety.png");
    const logoBuffer = fs.readFileSync(logoPath);
    const logoBase64 = logoBuffer.toString("base64");

    const subject = " Contrato rejeitado - ContractFlow";
    const plainText = `Olá ${contract.creator_name},\n\nSeu contrato #${contract.id} foi rejeitado por ${contract.rejected_by_name}.`;
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <img src="data:image/png;base64,${logoBase64}" alt="ContractFlow Logo" style="max-width: 200px; height: auto;">
        </div>
        
        <h1 style="color: #333; text-align: center;"> Contrato Rejeitado</h1>
        
        <p style="color: #555; font-size: 16px; line-height: 1.6;">
          Olá <strong>${contract.creator_name}</strong>, informamos sobre uma atualização importante.
        </p>
        
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #333; margin-top: 0; margin-bottom: 15px;"> Contrato Não Aprovado</h3>
          <p style="color: #555; font-size: 16px; margin-bottom: 10px;">
            O <strong>contrato #${contract.id}</strong> foi 
            <span style="color: #dc3545; font-weight: bold;"> rejeitado</span> 
            por <strong>${contract.rejected_by_name}</strong>.
          </p>
          <p style="color: #666; font-size: 14px; margin: 0;">
            Recomendamos entrar em contato para esclarecimentos.
          </p>
        </div>
        
        <div style="background-color: #f8d7da; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #dc3545;">
          <p style="color: #721c24; font-size: 14px; margin: 0;">
            <strong>Status:</strong> Contrato rejeitado<br>
            <strong>Rejeitado por:</strong> ${contract.rejected_by_name}<br>
            <strong>Data:</strong> ${new Date().toLocaleDateString('pt-BR')}<br>
            <strong>Horário:</strong> ${new Date().toLocaleTimeString('pt-BR')}
          </p>
        </div>
        
        <p style="color: #666; font-size: 14px;">
           <strong>Próximos passos:</strong> Entre em contato para esclarecimentos ou para criar uma nova versão do contrato.
        </p>
        
        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
        
        <p style="color: #888; font-size: 12px; text-align: center;">
          Empresa ContractFlow
        </p>
      </div>
    `;

    const emailSent = await sendEmail(
      contract.creator_email,
      subject,
      plainText,
      htmlContent
    );

    if (!emailSent) {
      return res.status(500).json({ error: "Erro ao enviar e-mail." });
    }

    res.json({ message: "E-mail de rejeição enviado com sucesso!" });
  } catch (error) {
    console.error("Erro ao enviar notificação de rejeição:", error);
    res.status(500).json({ error: "Erro interno ao enviar notificação." });
  }
});


router.post("/:id/generate-base64", verifyToken, async (req, res) => {
  const { id } = req.params;

  try {
    const [[contract]] = await pool.query(
      "SELECT conteudo FROM contratos WHERE id = ?",
      [id]
    );

    if (!contract || !contract.conteudo) {
      return res.status(404).json({ error: "Contrato não encontrado ou sem conteúdo." });
    }

    const fonts = {
      Helvetica: {
        normal: "Helvetica",
        bold: "Helvetica-Bold",
        italics: "Helvetica-Oblique",
        bolditalics: "Helvetica-BoldOblique",
      },
    };

    const printer = new PdfPrinter(fonts);
    const dom = new JSDOM(contract.conteudo);
    const { document } = dom.window;

    // ⛏️ Modifica todas as <img> para ter largura/altura máximas
    const images = document.querySelectorAll("img");
    images.forEach((img) => {
      img.setAttribute("style", "max-width: 300px; max-height: 200px;");
    });

    const html = document.body.innerHTML;
    // Remove ou substitui qualquer font-family suspeita por Helvetica
    const sanitizedHtml = html
      .replace(/font-family\s*:\s*[^;"]+;?/gi, "font-family: Helvetica;")
      .replace(/font-family\s*=\s*['"][^'"]+['"]/gi, 'font-family="Helvetica"'); // casos em atributos HTML


    const pdfContent = htmlToPdfmake(sanitizedHtml, { window: dom.window });

    const docDefinition = {
      defaultStyle: { font: "Helvetica", fontSize: 12 },
      content: [
        ...pdfContent,
      ],
      styles: {
        header: { fontSize: 16, bold: true, alignment: "center", margin: [0, 0, 0, 20] },
      },
    };

    const pdfDoc = printer.createPdfKitDocument(docDefinition);
    const chunks = [];

    pdfDoc.on("data", (chunk) => chunks.push(chunk));
    pdfDoc.on("end", async () => {
      const pdfBuffer = Buffer.concat(chunks);
      const base64 = pdfBuffer.toString("base64");

      await pool.query("UPDATE contratos SET pdf_base64 = ? WHERE id = ?", [base64, id]);

      res.json({
        message: "PDF gerado em base64 e salvo com sucesso.",
        pdf_base64: base64,
      });
    });

    pdfDoc.end();
  } catch (error) {
    console.error("❌ Erro ao gerar PDF em base64:", error);
    res.status(500).json({ error: "Erro ao gerar base64." });
  }
});


// Rota para atualizar apenas o conteúdo do contrato
router.patch("/:id/content", verifyToken, async (req, res) => {
  const { id } = req.params;
  const { content } = req.body;  // Conteúdo do contrato

  if (!content) {
    return res.status(400).json({ error: "Conteúdo do contrato é obrigatório." });
  }

  try {
    const [contract] = await pool.query("SELECT status FROM contratos WHERE id = ?", [id]);

    if (contract.length === 0) {
      return res.status(404).json({ error: "Contrato não encontrado." });
    }

    if (contract[0].status === "assinado") {
      return res.status(403).json({ error: "Contrato já foi assinado e não pode ser modificado." });
    }

    // Atualiza o conteúdo do contrato
    await pool.query("UPDATE contratos SET conteudo = ? WHERE id = ?", [content, id]);

    res.json({ message: "Conteúdo do contrato atualizado com sucesso!" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao atualizar conteúdo do contrato." });
  }
});


// Enviar contrato por WhatsApp para todos signatários
router.post("/:id/send-whatsapp", verifyToken, async (req, res) => {
  const { id } = req.params;
  try {
    // Buscar signatários com telefone e token
    const [signatories] = await pool.query(
      "SELECT telefone, access_token, name FROM signatarios WHERE contract_id = ? AND telefone IS NOT NULL",
      [id]
    );

    if (signatories.length === 0) {
      return res.status(404).json({ error: "Nenhum signatário com telefone encontrado para este contrato." });
    }

    // Buscar contrato para verificar se é do Autentique
    const [contracts] = await pool.query(
      "SELECT autentique FROM contratos WHERE id = ?",
      [id]
    );

    if (contracts.length === 0) {
      return res.status(404).json({ error: "Contrato não encontrado." });
    }

    const isAutentique = contracts[0].autentique === 1;

    // Disparar mensagem para cada signatário
    for (const { telefone, token_acesso, nome } of signatories) {
      // Formatar número para padrão internacional, se necessário
      const fone = telefone.replace(/\D/g, ""); // Exemplo básico, ajuste para seu padrão!

      // Se for do Autentique, usar o token_acesso diretamente (que é o link do Autentique)
      // Se não for do Autentique, usar o link do frontend
      const contractLink = isAutentique ? token_acesso : `https://frontend-contract-flow.vercel.app/contratual/assinar/${token_acesso}`;
      const message = ` *ContractFlow - Documento para Assinatura*

Olá${nome ? ` ${nome}` : ""}! 

Você tem um documento aguardando sua assinatura na plataforma ContractFlow.

 *Link para assinatura:*
${contractLink}

 *Importante:*
• Este link é exclusivo e seguro
• Recomendamos assinar o quanto antes
• Funciona em celular e computador

_Empresa ContractFlow_`;

      const zapiRes = await fetch("https://api.z-api.io/instances/3E448076F01990D12D01F2BEB582A0A9/token/C8029EF3519D4E08D972E992/send-text", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Client-Token": "Fa1b5d1944e5248848a63467268e3fdccS"
        },
        body: JSON.stringify({
          phone: fone, // Precisa estar no padrão correto!
          message,
        }),
      });
      const zapiData = await zapiRes.json();

      if (!zapiData.sent) {
        console.error(`Falha ao enviar para ${telefone}:`, zapiData);
      }
    }

    res.json({ message: "Mensagens enviadas por WhatsApp!" });
  } catch (error) {
    console.error("Erro ao enviar WhatsApp:", error);
    res.status(500).json({ error: "Erro ao enviar mensagens." });
  }
});


// Enviar contrato por WhatsApp via Evolution API
router.post("/:id/send-whatsapp-evolution", verifyToken, async (req, res) => {
  const { id } = req.params;

  const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL; // ex: http://localhost:8080
  const EVOLUTION_API_INSTANCE_NAME = process.env.EVOLUTION_API_INSTANCE_NAME; // ex: default (nome da instância)
  const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY; // apikey

  if (!EVOLUTION_API_URL || !EVOLUTION_API_INSTANCE_NAME || !EVOLUTION_API_KEY) {
    return res.status(500).json({ error: "Configuração da Evolution API ausente (EVOLUTION_API_URL, EVOLUTION_API_INSTANCE_NAME, EVOLUTION_API_KEY)." });
  }

  try {
    // Buscar signatários com telefone e token
    const [signatories] = await pool.query(
      "SELECT telefone, token_acesso, nome FROM signatarios WHERE contrato_id = ? AND telefone IS NOT NULL",
      [id]
    );

    if (signatories.length === 0) {
      return res.status(404).json({ error: "Nenhum signatário com telefone encontrado para este contrato." });
    }

    // Buscar contrato para verificar se é do Autentique
    const [contracts] = await pool.query(
      "SELECT autentique FROM contratos WHERE id = ?",
      [id]
    );

    if (contracts.length === 0) {
      return res.status(404).json({ error: "Contrato não encontrado." });
    }

    const isAutentique = contracts[0].autentique === 1;

    let enviados = 0;
    let falhas = 0;
    const detalhes = [];

    for (const { telefone, token_acesso, nome } of signatories) {
      const numero = (telefone || "").replace(/\D/g, "");

      // Monta o link conforme a origem
      const contractLink = isAutentique ? token_acesso : `https://frontend-contract-flow.vercel.app/contratual/assinar/${token_acesso}`;

      const text = ` *ContractFlow - Documento para Assinatura*\n\n` +
        `Olá${nome ? ` ${nome}` : ""}! \n\n` +
        `Você tem um documento aguardando sua assinatura na plataforma ContractFlow.\n\n` +
        `*Link para assinatura:*\n${contractLink}\n\n` +
        `*Importante:*\n` +
        `• Este link é exclusivo e seguro\n` +
        `• Recomendamos assinar o quanto antes\n` +
        `• Funciona em celular e computador\n\n` +
        `_Empresa ContractFlow_`;

      try {
        const resp = await fetch(`${EVOLUTION_API_URL.replace(/\/$/, "")}/message/sendText/${encodeURIComponent(EVOLUTION_API_INSTANCE_NAME)}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": EVOLUTION_API_KEY,
          },
          body: JSON.stringify({
            number: numero,
            text,
            options: { presence: "composing", delay: 250 }
          }),
        });

        const data = await resp.json().catch(() => ({}));
        if (resp.ok) {
          enviados++;
          detalhes.push({ telefone: numero, status: "enviado", data });
        } else {
          falhas++;
          detalhes.push({ telefone: numero, status: "falha", data });
        }
      } catch (err) {
        falhas++;
        detalhes.push({ telefone: numero, status: "erro", error: String(err) });
      }
    }

    return res.json({
      message: "Processo de envio via Evolution concluído",
      enviados,
      falhas,
      detalhes,
    });
  } catch (error) {
    console.error("Erro ao enviar WhatsApp via Evolution:", error);
    return res.status(500).json({ error: "Erro ao enviar mensagens via Evolution." });
  }
});


// Prolongar ou reabrir contrato expirado
router.patch('/:id/prolongar', verifyToken, async (req, res) => {
  const { id } = req.params;
  const { new_expires_at } = req.body;

  if (!new_expires_at) {
    return res.status(400).json({ error: "Nova data de expiração é obrigatória." });
  }

  try {
    // Verifica se está expirado
    const [[contrato]] = await pool.query(
      "SELECT status FROM contratos WHERE id = ?", [id]
    );

    if (!contrato) {
      return res.status(404).json({ error: "Contrato não encontrado." });
    }

    if (contrato.status !== "expirado") {
      return res.status(400).json({ error: "Só é possível prolongar contratos expirados." });
    }

    // Atualiza data e status
    await pool.query(
      "UPDATE contratos SET expirado_em = ?, status = 'pendente' WHERE id = ?",
      [new_expires_at, id]
    );

    res.json({ message: "Contrato reaberto e data de expiração atualizada com sucesso!" });
  } catch (error) {
    console.error("Erro ao prolongar contrato:", error);
    res.status(500).json({ error: "Erro ao prolongar contrato." });
  }
});

// No contracts.js (ou em uma rota separada se preferir)
router.post("/:id/generate-signatures-base64", async (req, res) => {
  const { id } = req.params;

  try {
    // 1. Buscar signatários e assinaturas desse contrato
    const [signatarios] = await pool.query("SELECT * FROM signatarios WHERE contrato_id = ?", [id]);
    const [assinaturas] = await pool.query("SELECT * FROM assinaturas WHERE contrato_id = ?", [id]);

    // 2. Montar o HTML da folha de assinaturas
    const blocoSignatariosHTML = `
      <div>
        <h2 style="margin-bottom:30px;text-align:center;">Folha de assinaturas</h2>
        ${signatarios.map(signatario => {
      const assinatura = assinaturas.find(a => a.signatario_id === signatario.id);
      if (!assinatura) {
        return `
              <div style="border-left: 4px solid #2196f3; margin-bottom: 10px; background: #f8f9fa; padding: 8px;">
                <b>Nome:</b> ${signatario.nome}<br>
                <b>Email:</b> ${signatario.email}<br>
                <b>Função:</b> ${signatario.funcao_assinatura}<br>
                <span style="color: #888;">Aguardando assinatura...</span>
              </div>
            `;
      } else {
        return `
              <div style="border-left: 4px solid #2196f3; margin-bottom: 10px; background: #f8f9fa; padding: 8px;">
                <b>Nome:</b> ${signatario.nome}<br>
                <b>Email:</b> ${signatario.email}<br>
                <b>Função:</b> ${signatario.funcao_assinatura}<br>
                <b>ID Contrato:</b> ${assinatura.contrato_id}<br>
                <b>IP:</b> ${assinatura.endereco_ip}<br>
                <b>Navegador:</b> ${assinatura.navegador_usuario}<br>
                <b>Data da Assinatura:</b> ${new Date(assinatura.assinado_em).toLocaleString()}<br>
                <div style="margin-top: 20px; border-top: 1px solid #333; text-align: right;">
                    <span style="font-family: Helvetica; font-size: 18px; font-style: italic;">${signatario.nome}</span>
                </div>
              </div>
            `;
      }
    }).join('')}
      </div>
    `;

    // 3. Gerar PDF usando pdfmake, html-to-pdfmake e jsdom
    const fonts = {
      Helvetica: {
        normal: "Helvetica",
        bold: "Helvetica-Bold",
        italics: "Helvetica-Oblique",
        bolditalics: "Helvetica-BoldOblique",
      },
    };

    const PdfPrinter = require("pdfmake");
    const htmlToPdfmake = require("html-to-pdfmake");
    const { JSDOM } = require("jsdom");

    const printer = new PdfPrinter(fonts);
    const dom = new JSDOM(blocoSignatariosHTML);
    const pdfContent = htmlToPdfmake(dom.window.document.body.innerHTML, { window: dom.window });

    const docDefinition = {
      defaultStyle: { font: "Helvetica", fontSize: 12 },
      content: [
        ...pdfContent,
      ],
      styles: {
        header: { fontSize: 16, bold: true, alignment: "center", margin: [0, 0, 0, 20] },
      },
      pageMargins: [40, 60, 40, 60],
    };

    const pdfDoc = printer.createPdfKitDocument(docDefinition);
    const chunks = [];

    pdfDoc.on("data", (chunk) => chunks.push(chunk));
    pdfDoc.on("end", async () => {
      const pdfBuffer = Buffer.concat(chunks);
      const base64 = pdfBuffer.toString("base64");

      await pool.query("UPDATE contratos SET assinatura_base64 = ? WHERE id = ?", [base64, id]);

      res.json({
        message: "Folha de assinaturas em PDF gerada e salva com sucesso.",
        assinatura_base64: base64,
      });
    });

    pdfDoc.end();
  } catch (error) {
    console.error("❌ Erro ao gerar folha de assinaturas:", error);
    res.status(500).json({ error: "Erro ao gerar folha de assinaturas." });
  }
});


// No arquivo signatures.js ou contracts.js
router.patch("/:access_token/update-signature-base64", async (req, res) => {
  const { access_token } = req.params;
  try {
    // 1. Buscar o contrato e signatário pelo access_token
    const [[info]] = await pool.query(
      `SELECT c.id as contract_id
       FROM contratos c 
       JOIN signatarios s ON c.id = s.contrato_id
       WHERE s.token_acesso = ?`,
      [access_token]
    );

    if (!info) {
      return res.status(404).json({ error: "Contrato não encontrado." });
    }

    const contractId = info.contract_id;

    // 2. Gerar a folha de assinaturas (pode reaproveitar o código da rota PATCH /contracts/:id/update-signature-base64)
    // -- copie a mesma lógica! --
    const [signatarios] = await pool.query("SELECT * FROM signatarios WHERE contrato_id = ?", [contractId]);
    const [assinaturas] = await pool.query("SELECT * FROM assinaturas WHERE contrato_id = ?", [contractId]);

    const blocoSignatariosHTML = `
      <div>
        <h2 style="margin-bottom:30px;text-align:center;">Folha de assinaturas</h2>
        ${signatarios.map(signatario => {
      const assinatura = assinaturas.find(a => a.signatario_id === signatario.id);
      if (!assinatura) {
        return `
              <div style="border-left: 4px solid #2196f3; margin-bottom: 10px; background: #f8f9fa; padding: 8px;">
                <b>Nome:</b> ${signatario.nome}<br>
                <b>Email:</b> ${signatario.email}<br>
                <b>Função:</b> ${signatario.funcao_assinatura}<br>
                <span style="color: #888;">⏳ Aguardando assinatura...</span>
              </div>
            `;
      } else {
        return `
              <div style="border-left: 4px solid #2196f3; margin-bottom: 10px; background: #f8f9fa; padding: 8px;">
                <b>Nome:</b> ${signatario.nome}<br>
                <b>Email:</b> ${signatario.email}<br>
                <b>Função:</b> ${signatario.funcao_assinatura}<br>
                <b>ID Contrato:</b> ${assinatura.contrato_id}<br>
                <b>IP:</b> ${assinatura.endereco_ip}<br>
                <b>Navegador:</b> ${assinatura.navegador_usuario}<br>
                <b>Data da Assinatura:</b> ${new Date(assinatura.assinado_em).toLocaleString()}<br>
                <div style="margin-top: 20px; border-top: 1px solid #333; text-align: right;">
                    <span style="font-family: Helvetica; font-size: 18px; font-style: italic;">${signatario.nome}</span>
                </div>
              </div>
            `;
      }
    }).join('')}
      </div>
    `;

    // Gerar o PDF (igual sua rota de update-signature-base64)
    const PdfPrinter = require("pdfmake");
    const htmlToPdfmake = require("html-to-pdfmake");
    const { JSDOM } = require("jsdom");
    const fonts = {
      Helvetica: {
        normal: "Helvetica",
        bold: "Helvetica-Bold",
        italics: "Helvetica-Oblique",
        bolditalics: "Helvetica-BoldOblique",
      },
    };
    const printer = new PdfPrinter(fonts);
    const dom = new JSDOM(blocoSignatariosHTML);
    const pdfContent = htmlToPdfmake(dom.window.document.body.innerHTML, { window: dom.window });

    const docDefinition = {
      defaultStyle: { font: "Helvetica", fontSize: 12 },
      content: [
        ...pdfContent,
      ],
      styles: {
        header: { fontSize: 16, bold: true, alignment: "center", margin: [0, 0, 0, 20] },
      },
      pageMargins: [40, 60, 40, 60],
    };

    const pdfDoc = printer.createPdfKitDocument(docDefinition);
    const chunks = [];
    pdfDoc.on("data", (chunk) => chunks.push(chunk));
    pdfDoc.on("end", async () => {
      const pdfBuffer = Buffer.concat(chunks);
      const base64 = pdfBuffer.toString("base64");

      await pool.query("UPDATE contratos SET assinatura_base64 = ? WHERE id = ?", [base64, contractId]);

      res.json({
        message: "Folha de assinaturas atualizada e salva com sucesso.",
        assinatura_base64: base64,
      });
    });

    pdfDoc.end();
  } catch (error) {
    console.error("❌ Erro ao atualizar folha de assinaturas via access_token:", error);
    res.status(500).json({ error: "Erro ao atualizar folha de assinaturas." });
  }
});

// Buscar todos os signatários do contrato via access_token
router.get("/token/:access_token/signatories", async (req, res) => {
  const { access_token } = req.params;
  try {
    // Busca o contrato_id a partir do token_acesso do signatário
    const [[signatario]] = await pool.query(
      "SELECT contrato_id FROM signatarios WHERE token_acesso = ?",
      [access_token]
    );
    if (!signatario) {
      return res.status(404).json({ error: "Signatário não encontrado." });
    }

    // Busca todos os signatários desse contrato
    const [signatarios] = await pool.query(
      "SELECT * FROM signatarios WHERE contrato_id = ?",
      [signatario.contrato_id]
    );
    res.json(signatarios);
  } catch (error) {
    console.error("Erro ao buscar signatários via access_token:", error);
    res.status(500).json({ error: "Erro ao buscar signatários." });
  }
});

// Buscar todas as assinaturas do contrato via access_token
router.get("/token/:access_token/signatures", async (req, res) => {
  const { access_token } = req.params;
  try {
    // Busca o contrato_id a partir do token_acesso do signatário
    const [[signatario]] = await pool.query(
      "SELECT contrato_id FROM signatarios WHERE token_acesso = ?",
      [access_token]
    );
    if (!signatario) {
      return res.status(404).json({ error: "Signatário não encontrado." });
    }

    // Busca todas as assinaturas desse contrato
    const [assinaturas] = await pool.query(
      `SELECT s.id, s.contrato_id, s.cpf, s.assinado_em, s.endereco_ip, s.navegador_usuario, s.hash, 
              si.id AS signatory_id, si.nome, si.email
       FROM assinaturas s
       JOIN signatarios si ON s.signatario_id = si.id
       WHERE s.contrato_id = ?`,
      [signatario.contrato_id]
    );

    if (assinaturas.length === 0) {
      return res.status(404).json({ error: "Nenhuma assinatura encontrada para este contrato." });
    }

    res.json(assinaturas);
  } catch (error) {
    console.error("Erro ao buscar assinaturas via access_token:", error);
    res.status(500).json({ error: "Erro ao buscar assinaturas." });
  }
});


// Enviar notificação por e-mail ao criador e signatários quando o contrato for assinado
router.post("/:id/notificar-assinatura", async (req, res) => {
  const { id } = req.params;

  try {
    // Buscar contrato + criador
    const [[contract]] = await pool.query(`
      SELECT c.id, c.status, 
             u.email AS creator_email, u.nome AS creator_name
      FROM contratos c
      JOIN usuarios u ON c.criado_por = u.id
      WHERE c.id = ?
    `, [id]);

    if (!contract) {
      return res.status(404).json({ error: "Contrato não encontrado." });
    }

    if (contract.status !== "assinado") {
      return res.status(400).json({ error: "Contrato ainda não foi assinado por todos." });
    }

    // Buscar todos os signatários do contrato com token_acesso
    const [signatories] = await pool.query(
      "SELECT email, nome, token_acesso FROM signatarios WHERE contrato_id = ?",
      [id]
    );

    // Buscar admin da empresa
    const [admin] = await pool.query(`
      SELECT u.email, u.nome
      FROM usuarios u
      JOIN usuarios_empresas ue ON u.id = ue.usuario_id
      WHERE ue.empresa_id = ?
      LIMIT 1
    `, [contract.empresa_id]);

    // 📧 Envia o e-mail de notificação
    // Carrega a logo como base64
    const logoPath = path.join(__dirname, "../../assets/img/Logo-Onety.png");
    const logoBuffer = fs.readFileSync(logoPath);
    const logoBase64 = logoBuffer.toString("base64");


    let emailsEnviados = 0;
    let emailsFalharam = 0;

    // Enviar email para o criador
    const subjectCriador = " Contrato assinado - ContractFlow";
    const plainTextCriador = `Olá ${contract.creator_name},\n\nO contrato #${contract.id} foi assinado por todos os signatários.\n\nLink do contrato: https://frontend-contract-flow.vercel.app/contratual/contrato/${contract.id}\n\nLinks dos signatários:\n${signatories.map(s => `- ${s.nome}: https://frontend-contract-flow.vercel.app/contratual/assinar/${s.token_acesso}`).join('\n')}`;
    const htmlContentCriador = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <img src="data:image/png;base64,${logoBase64}" alt="ContractFlow Logo" style="max-width: 200px; height: auto;">
        </div>
        
        <h1 style="color: #333; text-align: center;"> Contrato Assinado!</h1>
        
        <p style="color: #555; font-size: 16px; line-height: 1.6;">
          Olá <strong>${contract.creator_name}</strong>, temos uma ótima notícia!
        </p>
        
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #333; margin-top: 0; margin-bottom: 15px;"> Contrato Finalizado</h3>
          <p style="color: #555; font-size: 16px; margin-bottom: 10px;">
            O <strong>contrato #${contract.id}</strong> foi 
            <span style="color: #28a745; font-weight: bold;"> assinado</span> 
            por todos os signatários.
          </p>
        </div>

                <div style="background-color: #e7f3ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #333; margin-top: 0; margin-bottom: 15px;"> Links dos Signatários</h3>
          ${signatories.map(signatory => `
            <div style="margin-bottom: 15px; padding: 10px; background-color: white; border-radius: 4px; border-left: 3px solid #007bff;">
              <p style="margin: 0 0 8px 0; font-weight: bold; color: #333;">${signatory.nome}</p>
              <a href="https://frontend-contract-flow.vercel.app/contratual/assinar/${signatory.token_acesso}" style="color: #007bff; font-size: 14px; word-break: break-all;">
                https://frontend-contract-flow.vercel.app/contratual/assinar/${signatory.token_acesso}
              </a>
            </div>
          `).join('')}
        </div>
        
        <div style="background-color: #e8f5e8; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #28a745;">
          <p style="color: #155724; font-size: 14px; margin: 0;">
            <strong>Status:</strong> Contrato assinado com sucesso<br>
            <strong>Data:</strong> ${new Date().toLocaleDateString('pt-BR')}<br>
            <strong>Horário:</strong> ${new Date().toLocaleTimeString('pt-BR')}
          </p>
        </div>
        
        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
        
        <p style="color: #888; font-size: 12px; text-align: center;">
           Empresa ContractFlow
        </p>
      </div>
    `;

    const emailCriadorEnviado = await sendEmail(
      contract.creator_email,
      subjectCriador,
      plainTextCriador,
      htmlContentCriador
    );

    if (emailCriadorEnviado) {
      emailsEnviados++;
    } else {
      emailsFalharam++;
    }

    // Enviar email para cada signatário
    const subjectSignatario = " Documento assinado com sucesso - ContractFlow";

    for (const { email, nome, token_acesso } of signatories) {
      const plainTextSignatario = `Olá ${nome},\n\nO documento que você assinou foi finalizado com sucesso.\n\nContrato #${contract.id} - Status: Assinado por todos os participantes.\n\nSeu link de acesso: https://frontend-contract-flow.vercel.app/contratual/assinar/${token_acesso}`;
      const htmlContentSignatario = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <img src="data:image/png;base64,${logoBase64}" alt="ContractFlow Logo" style="max-width: 200px; height: auto;">
          </div>
          
          <h1 style="color: #333; text-align: center;"> Documento Finalizado!</h1>
          
          <p style="color: #555; font-size: 16px; line-height: 1.6;">
            Olá <strong>${nome}</strong>, obrigado por sua assinatura!
          </p>
          
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #333; margin-top: 0; margin-bottom: 15px;"> Assinatura Confirmada</h3>
            <p style="color: #555; font-size: 16px; margin-bottom: 10px;">
              O <strong>documento #${contract.id}</strong> foi 
              <span style="color: #28a745; font-weight: bold;"> finalizado</span> 
              com sucesso após ser assinado por todos os participantes.
            </p>
          </div>

                    <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #333; margin-top: 0; margin-bottom: 15px;"> Seu Link de Acesso</h3>
            <div style="text-align: center; margin: 20px 0;">
              <a href="https://frontend-contract-flow.vercel.app/contratual/assinar/${token_acesso}" style="background-color: #28a745; color: white; padding: 12px 25px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
                 Acessar Documento
              </a>
            </div>
            <p style="color: #666; font-size: 14px; text-align: center; margin: 0;">
              <a href="https://frontend-contract-flow.vercel.app/contratual/assinar/${token_acesso}" style="color: #007bff; word-break: break-all;">https://frontend-contract-flow.vercel.app/contratual/assinar/${token_acesso}</a>
            </p>
          </div>
          
          <div style="background-color: #e8f5e8; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #28a745;">
            <p style="color: #155724; font-size: 14px; margin: 0;">
              <strong>Status:</strong> Documento finalizado com sucesso<br>
              <strong>Data:</strong> ${new Date().toLocaleDateString('pt-BR')}<br>
              <strong>Horário:</strong> ${new Date().toLocaleTimeString('pt-BR')}
            </p>
          </div>
          
          <p style="color: #666; font-size: 14px;">
            O documento está agora completo e disponível para todas as partes envolvidas.
          </p>
          
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          
          <p style="color: #888; font-size: 12px; text-align: center;">
             Empresa ContractFlow
          </p>
        </div>
      `;

      const emailSignatarioEnviado = await sendEmail(
        email,
        subjectSignatario,
        plainTextSignatario,
        htmlContentSignatario
      );

      if (emailSignatarioEnviado) {
        emailsEnviados++;
      } else {
        emailsFalharam++;
      }
    }

    // Enviar email para o admin (se existir)
    if (admin.length > 0) {
      const adminData = admin[0];
      const subjectAdmin = " Contrato assinado - Admin - ContractFlow";
      const plainTextAdmin = `Olá ${adminData.nome},\n\nO contrato #${contract.id} foi assinado por todos os signatários.\n\nLink do contrato: https://frontend-contract-flow.vercel.app/contratual/contrato/${contract.id}\n\nLinks dos signatários:\n${signatories.map(s => `- ${s.nome}: https://frontend-contract-flow.vercel.app/contratual/assinar/${s.token_acesso}`).join('\n')}`;

      const htmlContentAdmin = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <img src="data:image/png;base64,${logoBase64}" alt="ContractFlow Logo" style="max-width: 200px; height: auto;">
          </div>
          
          <h1 style="color: #333; text-align: center;"> Contrato Assinado - Admin</h1>
          
          <p style="color: #555; font-size: 16px; line-height: 1.6;">
            Olá <strong>${adminData.nome}</strong>, o contrato #${contract.id} foi finalizado com sucesso!
          </p>
          
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #333; margin-top: 0; margin-bottom: 15px;"> Contrato Finalizado</h3>
            <p style="color: #555; font-size: 16px; margin-bottom: 10px;">
              O <strong>contrato #${contract.id}</strong> foi 
              <span style="color: #28a745; font-weight: bold;"> assinado</span> 
              por todos os signatários.
            </p>
          </div>
          
          <div style="background-color: #e8f5e8; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #28a745;">
            <p style="color: #155724; font-size: 14px; margin: 0;">
              <strong>Status:</strong> Contrato assinado com sucesso<br>
              <strong>Data:</strong> ${new Date().toLocaleDateString('pt-BR')}<br>
              <strong>Horário:</strong> ${new Date().toLocaleTimeString('pt-BR')}
            </p>
          </div>
          
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #333; margin-top: 0; margin-bottom: 15px;"> Link do Contrato</h3>
            <div style="text-align: center; margin: 20px 0;">
              <a href="https://frontend-contract-flow.vercel.app/contratual/contrato/${contract.id}" style="background-color: #007bff; color: white; padding: 12px 25px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
                 Visualizar Contrato
              </a>
            </div>
            <p style="color: #666; font-size: 14px; text-align: center; margin: 0;">
              <a href="https://frontend-contract-flow.vercel.app/contratual/contrato/${contract.id}" style="color: #007bff; word-break: break-all;">https://frontend-contract-flow.vercel.app/contratual/contrato/${contract.id}</a>
            </p>
          </div>
          
          <div style="background-color: #fff3cd; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;">
            <h3 style="color: #333; margin-top: 0; margin-bottom: 15px;"> Links dos Signatários</h3>
            ${signatories.map(signatory => `
              <div style="margin-bottom: 15px; padding: 10px; background-color: white; border-radius: 4px; border-left: 3px solid #ffc107;">
                <p style="margin: 0 0 8px 0; font-weight: bold; color: #333;">${signatory.nome}</p>
                <a href="https://frontend-contract-flow.vercel.app/contratual/assinar/${signatory.token_acesso}" style="color: #007bff; font-size: 14px; word-break: break-all;">
                  https://frontend-contract-flow.vercel.app/contratual/assinar/${signatory.token_acesso}
                </a>
              </div>
            `).join('')}
          </div>
          
          <div style="background-color: #d1ecf1; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #17a2b8;">
            <p style="color: #0c5460; font-size: 14px; margin: 0;">
              <strong> Acesso Admin:</strong> Você tem acesso a todos os links deste contrato.<br>
              <strong> Total de Signatários:</strong> ${signatories.length}<br>
              <strong> Status do Contrato:</strong> ${contract.status}
            </p>
          </div>
          
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          
          <p style="color: #888; font-size: 12px; text-align: center;">
             Empresa ContractFlow
          </p>
        </div>
      `;

      const emailAdminEnviado = await sendEmail(
        adminData.email,
        subjectAdmin,
        plainTextAdmin,
        htmlContentAdmin
      );

      if (emailAdminEnviado) {
        emailsEnviados++;
      } else {
        emailsFalharam++;
      }
    }

    res.json({
      message: `✅ Notificações enviadas com sucesso!`,
      detalhes: {
        emailsEnviados,
        emailsFalharam,
        totalDestinatarios: 1 + signatories.length + (admin.length > 0 ? 1 : 0),
          destinatarios: {
          criador: contract.creator_email,
          signatarios: signatories.map(s => ({ nome: s.nome, email: s.email })),
          admin: admin.length > 0 ? admin[0].email : null
        }
      }
    });
  } catch (error) {
    console.error("Erro ao enviar notificação de assinatura:", error);
    res.status(500).json({ error: "Erro interno ao enviar notificação." });
  }
});


module.exports = router;
