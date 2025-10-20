const express = require("express");
const { createDocumentAutentique, getDocumentAutentique, deleteDocumentAutentique, getDocumentFiles } = require("../../services/contratual/autentique");
const db = require("../../config/database"); // conexão MySQL (mysql2/promise)
const verifyToken = require("../../middlewares/auth");
const PdfPrinter = require("pdfmake");
const htmlToPdfmake = require("html-to-pdfmake");
const { JSDOM } = require("jsdom");
const crypto = require("crypto");
const axios = require("axios");
const cloudinary = require("../../config/cloudinary");
const multer = require("multer");
const upload = multer({ storage: multer.memoryStorage() });
const webSocketManager = require("../../websocket");


const router = express.Router();

// troca .../pades.pdf (com ou sem querystring) por .../certificado.pdf
function fixPadesUrl(url) {
  if (typeof url !== "string") return url;
  return url.replace(/\/pades\.pdf(\?.*)?$/i, (_m, qs = "") => `/certificado.pdf${qs}`);
}


/**
 * 📌 1️⃣ Rota para HTML com variáveis (converte para PDF e envia para Autentique)
 * Segue a mesma estrutura da rota de documentos.js
 */
router.post("/html", verifyToken, async (req, res) => {
  const { 
    template_id, 
    client_id, 
    signatories, 
    variables, 
    empresa_id, 
    expires_at,
    start_at,
    end_at
  } = req.body;
  const createdBy = req.user.id;

  // Validação dos campos (mesma estrutura do documentos.js)
  if (!template_id || !client_id || !Array.isArray(signatories) || signatories.length === 0 || !empresa_id) {
    return res.status(400).json({ error: "Preencha todos os campos obrigatórios." });
  }

  if (!expires_at) {
    return res.status(400).json({ error: "O campo expires_at é obrigatório." });
  }

  try {
    // 1️⃣ Buscar conteúdo do template (mesmo que documentos.js)
    const [[template]] = await db.query(
      "SELECT conteudo FROM modelos_contrato WHERE id = ?",
      [template_id]
    );

    if (!template) {
      return res.status(404).json({ error: "Template não encontrado." });
    }

    // 2️⃣ Substituir as variáveis no conteúdo do template (mesmo que documentos.js)
    let filledContent = template.conteudo;
    if (variables && Array.isArray(variables)) {
      variables.forEach(({ variable_name, value }) => {
        const regex = new RegExp(`{{\\s*${variable_name}\\s*}}`, "g");
        filledContent = filledContent.replace(regex, value);
      });
    }

    // 3️⃣ Converter HTML para PDF (baseado na rota generate-base64)
    const fonts = {
      Helvetica: {
        normal: "Helvetica",
        bold: "Helvetica-Bold",
        italics: "Helvetica-Oblique",
        bolditalics: "Helvetica-BoldOblique",
      },
    };

    const printer = new PdfPrinter(fonts);
    const dom = new JSDOM(filledContent);
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
      .replace(/font-family\s*=\s*['"][^'"]+['"]/gi, 'font-family="Helvetica"');

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
      try {
        const pdfBuffer = Buffer.concat(chunks);
        const pdfBase64 = pdfBuffer.toString('base64');
        // 🔼 Envia o PDF para o Cloudinary e usa a URL como conteudo
        const base64DataUri = `data:application/pdf;base64,${pdfBase64}`;
        const cloudUpload = await cloudinary.uploader.upload(base64DataUri, {
          folder: "onety/contratual/documentos",
          resource_type: "auto",
        });

        // 4️⃣ Criar documento no Autentique com PDF convertido
        const doc = await createDocumentAutentique(
          `Contrato ${template_id}`,
          pdfBase64,
          signatories.map(sig => ({
            name: sig.name,
            cpf: sig.cpf || null
          }))
        );

        // 5️⃣ Criar o contrato no banco (mesma estrutura do documentos.js)
         const [documentResult] = await db.query(
          "INSERT INTO documentos (modelos_contrato_id, conteudo, status, criado_por, pre_cliente_id, expirado_em, comeca_em, termina_em, empresa_id, autentique, autentique_id) VALUES (?, ?, 'pendente', ?, ?, ?, ?, ?, ?, ?, ?)",
           [template_id, cloudUpload.secure_url, createdBy, client_id, expires_at, start_at, end_at, empresa_id, 1, doc.id,]
        );

        const document_id = documentResult.insertId;

        // 6️⃣ Adicionar múltiplos signatários (mesma estrutura do documentos.js)
        for (const signatory of signatories) {
          const { name, email, cpf, birth_date, telefone, funcao_assinatura } = signatory;
          const token_acesso = crypto.randomBytes(32).toString("hex");
          // Trata string vazia e undefined como null
          const birthDateToSave = birth_date && birth_date.trim() !== "" ? birth_date : null;

          await db.query(
            "INSERT INTO signatarios (documento_id, nome, email, cpf, data_nascimento, token_acesso, telefone, empresa_id, funcao_assinatura) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [document_id, name, email, cpf, birthDateToSave, token_acesso, telefone, empresa_id, funcao_assinatura]
          );
        }

        // 7️⃣ Salvar signatários do Autentique no banco
        const validSignatures = doc.signatures.filter(sig => sig.action);
        for (let i = 0; i < validSignatures.length; i++) {
          const sig = validSignatures[i];
          const inputData = signatories[i];

          await db.query(
            `UPDATE signatarios SET 
               public_id = ?, 
               token_acesso = ? 
             WHERE documento_id = ? AND email = ?`,
            [
              sig.public_id,
              sig.link?.short_link || null,
              document_id,
              inputData.email
            ]
          );
        }

        res.status(201).json({
          message: "✅ Contrato criado, convertido para PDF e enviado para Autentique",
          document_id,
          autentique_id: doc.id,
          expires_at: expires_at
        });

      } catch (err) {
        console.error("❌ Erro ao processar PDF ou criar contrato:", err);
        res.status(500).json({ error: "Erro ao processar contrato HTML" });
      }
    });

    pdfDoc.end();

  } catch (error) {
    console.error("❌ Erro ao criar contrato HTML:", error);
    res.status(500).json({ error: "Erro ao criar contrato HTML." });
  }
});

/**
 * 📌 2️⃣ Rota para PDF direto (mantém a funcionalidade existente)
 */
// Aceita JSON (content base64) ou multipart (arquivo PDF em req.file)
router.post("/", verifyToken, upload.single("arquivo"), async (req, res) => {
  try {
    const { 
      name, 
      content, 
      signatories: signatoriesRaw, 
      empresa_id, 
      created_by, 
      client_id,
      start_at,
      end_at,
      expires_at
    } = req.body;

    // signatories pode vir como string JSON quando multipart
    const signatories = typeof signatoriesRaw === "string" ? JSON.parse(signatoriesRaw) : (signatoriesRaw || []);

    // Se vier arquivo PDF via multipart, converte para base64 data-less
    let pdfBase64 = content;
    if (!pdfBase64 && req.file) {
      pdfBase64 = req.file.buffer.toString("base64");
    }

    // 🔼 Envia o PDF ao Cloudinary para termos uma URL pública
    if (!pdfBase64 && !req.file) {
      return res.status(400).json({ error: "Arquivo PDF ou conteúdo base64 é obrigatório." });
    }
    const dataUri = pdfBase64 ? `data:application/pdf;base64,${pdfBase64}` : `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;
    const cloudUpload = await cloudinary.uploader.upload(dataUri, {
      folder: "onety/contratual/documentos",
      resource_type: "auto",
    });

    // 1️⃣ Cria documento no Autentique
    const doc = await createDocumentAutentique(
      name,
      pdfBase64 || req.file.buffer.toString("base64"),
      signatories.map(sig => ({
        name: sig.name,
        cpf: sig.cpf || null
      }))
    );

    // 2️⃣ Salva contrato no banco
    const [documentResult] = await db.query(
      `INSERT INTO documentos (
         autentique, 
         autentique_id, 
         status, 
         conteudo, 
         empresa_id, 
         pre_cliente_id,
         criado_em,
         criado_por,
         comeca_em,
         termina_em,
         expirado_em
       )
       VALUES (?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?, ?)`,
      [
        1,                          // autentique
        doc.id,                    // autentique_id
        "pendente",                // status
        cloudUpload.secure_url,     // conteudo (URL do Cloudinary)
        empresa_id,                // empresa_id
        client_id,                 // pre_cliente_id
         (created_by || req.user?.id || null), // criado_por
        start_at || null,          // comeca_em
        end_at || null,            // termina_em
        expires_at || null         // expirado_em
      ]
    );

    const documentId = documentResult.insertId;

    // 3️⃣ Filtra os signatários válidos
    const validSignatures = doc.signatures.filter(sig => sig.action);

    // 4️⃣ Salva os signatários no banco (com empresa_id)
    for (let i = 0; i < validSignatures.length; i++) {
      const sig = validSignatures[i];
      const inputData = signatories[i];

      await db.query(
        `INSERT INTO signatarios (
           documento_id, 
           nome, 
           email, 
           public_id, 
           token_acesso, 
           cpf, 
           telefone,
           empresa_id
         )
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          documentId,
          sig.name || "",
          inputData.email || "",
          sig.public_id,
          sig.link?.short_link || null,
          inputData.cpf || null,
          inputData.phone || null,
          empresa_id || null
        ]
      );
    }

    res.json({
      message: "✅ Contrato PDF criado e salvo com datas",
      autentique_id: doc.id,
      document_id: documentId
    });

  } catch (err) {
    console.error("❌ Erro ao criar contrato PDF:", err);
    res.status(500).json({ error: "Erro ao criar contrato PDF" });
  }
});


// POST /documentos-autentique/webhook-dados-assinatura
router.post("/webhook-dados-assinatura", async (req, res) => {
  const { event } = req.body;

  console.log("🔔 Webhook recebido:", {
    eventType: event.type,
    autentiqueId: event.data.document,
    cpf: event.data.cpf,
    user: event.data.user
  });

  const eventType = event.type;
  const eventData = event.data;

  const autentiqueId = eventData.document; // ID do documento no Autentique
  const isRejection = eventType === "signature.rejected";

  // Campos que só fazem sentido para assinatura
  const ip = eventData.events?.find(e => e.type === "signed")?.ip || null;
  const userAgent = req.headers["user-agent"] || "Autentique Webhook";
  const signedAt = new Date(eventData.signed || new Date());

  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    // 1) Contrato pelo autentique_id
    const [[document]] = await connection.query(
      `SELECT id FROM documentos WHERE autentique_id = ?`,
      [autentiqueId]
    );
    console.log("🔍 Busca documento:", { 
      autentiqueId, 
      documentFound: !!document, 
      documentId: document?.id 
    });

    // Debug: verificar se existe algum documento com autentique_id similar
    if (!document) {
      const [debugDocumentos] = await connection.query(
        `SELECT id, autentique_id FROM documentos WHERE autentique_id LIKE ? OR autentique_id LIKE ?`,
        [`%${autentiqueId.substring(0, 10)}%`, `%${autentiqueId.substring(-10)}%`]
      );
      console.log("🔍 Debug - Documentos similares:", debugDocumentos);
    }

    if (!document) {
      await connection.rollback();
      return res.status(404).json({ error: "Contrato não encontrado no sistema." });
    }

    const documentId = document.id;
    console.log("📋 document ID encontrado:", documentId);

    // --- CASO: REJEIÇÃO (não mexe em signatures) ---
    if (isRejection) {
      // tentar identificar quem rejeitou, se houver cpf
      const cpfRaw = eventData.user?.cpf || eventData.cpf;
      let signatoryId = null;

      if (cpfRaw) {
        // busca direta
        let [[signatory]] = await connection.query(
          `SELECT id FROM signatarios WHERE documento_id = ? AND cpf = ?`,
          [documentId, cpfRaw]
        );

        // busca sem formatação
        if (!signatory) {
          const cpfOnlyNumbers = String(cpfRaw).replace(/\D/g, "");
          [[signatory]] = await connection.query(
            `SELECT id FROM signatarios 
             WHERE documento_id = ? 
               AND REPLACE(REPLACE(REPLACE(cpf, '.', ''), '-', ''), ' ', '') = ?`,
            [documentId, cpfOnlyNumbers]
          );
        }

        if (signatory) signatoryId = signatory.id;
      }

      await connection.query(
        `UPDATE documentos SET status = 'reprovado', rejeitado_por = ? WHERE id = ?`,
        [signatoryId, documentId] // pode ser null se não achou cpf/signatário
      );

      await connection.commit();
      return res.status(200).json({ message: `Evento ${eventType} processado (rejeição sem inserir em assinaturas).` });
    }

    // --- CASO: ASSINATURA ---
    const cpf = eventData.user?.cpf || eventData.cpf;
    if (!cpf) {
      await connection.rollback();
      return res.status(400).json({ error: "CPF do signatário é obrigatório para registrar assinatura." });
    }

    // 2) Buscar signatário (com busca flexível)
    let [[signatory]] = await connection.query(
      `SELECT id FROM signatarios WHERE documento_id = ? AND cpf = ?`,
      [documentId, cpf]
    );

    if (!signatory) {
      const cpfOnlyNumbers = String(cpf).replace(/\D/g, "");
      [[signatory]] = await connection.query(
        `SELECT id FROM signatarios 
         WHERE documento_id = ? 
           AND REPLACE(REPLACE(REPLACE(cpf, '.', ''), '-', ''), ' ', '') = ?`,
        [documentId, cpfOnlyNumbers]
      );
    }

    console.log("🔍 Busca signatário:", { documentId, cpf, signatoryFound: !!signatory });

    if (!signatory) {
      const [allSignatories] = await connection.query(
        `SELECT id, nome, email, cpf FROM signatarios WHERE documento_id = ?`,
        [documentId]
      );

      console.log("🔍 Debug - Todos os signatários do contrato:", allSignatories);
      console.log("🔍 Debug - CPF procurado:", cpf);

      await connection.rollback();
      return res.status(404).json({
        error: "Signatário não encontrado.",
        debug: { documentId, cpf, availableSignatories: allSignatories }
      });
    }

    const signatoryId = signatory.id;

    // Evitar duplicidade
    const [[existingSignature]] = await connection.query(
      "SELECT id FROM assinaturas WHERE documento_id = ? AND signatario_id = ?",
      [documentId, signatoryId]
    );
    if (existingSignature) {
      await connection.rollback();
      return res.status(200).json({ message: "Assinatura já registrada." });
    }

    // Inserir assinatura
    const hashBase = `${cpf}-${documentId}-${ip}`;
    const hash = crypto.createHash("sha256").update(hashBase).digest("hex");

    await connection.query(
      `INSERT INTO assinaturas (documento_id, signatario_id, cpf, assinado_em, endereco_ip, navegador_usuario, hash)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [documentId, signatoryId, cpf, signedAt, ip, userAgent, hash]
    );

    await connection.query(
      `UPDATE signatarios SET assinado_em = ? WHERE id = ?`,
      [signedAt, signatoryId]
    );

    // Se todos assinaram, marca contrato como assinado
    const [[{ total }]] = await connection.query(
      "SELECT COUNT(*) as total FROM signatarios WHERE documento_id = ?",
      [documentId]
    );
    const [[{ assinados }]] = await connection.query(
      "SELECT COUNT(*) as assinados FROM signatarios WHERE documento_id = ? AND assinado_em IS NOT NULL",
      [documentId]
    );
    let documentoCompletamenteAssinado = false;
    if (assinados === total) {
      await connection.query(
        "UPDATE documentos SET status = 'assinado' WHERE id = ?",
        [documentId]
      );
      documentoCompletamenteAssinado = true;
    }

    await connection.commit();

    // 🔔 Notificação in-app: documento completamente assinado
    if (documentoCompletamenteAssinado) {
      try {
        const [[meta]] = await db.query(
          `SELECT empresa_id, criado_por AS created_by FROM documentos WHERE id = ?`,
          [documentId]
        );
        const userId = meta?.created_by || null;
        const empresaId = meta?.empresa_id || null;
        if (userId) {
          const title = 'Documento assinado';
          const body = `${title} #${documentId}`;
          const dataJson = JSON.stringify({ tipo: 'documentos', id: documentId });
          await db.query(
            `INSERT INTO user_notifications (user_id, empresa_id, module, type, title, body, data_json, entity_type, entity_id, created_by)
             VALUES (?, ?, 'contratual', 'document.signed', ?, ?, ?, 'documento', ?, ?)`,
            [userId, empresaId, title, body, dataJson, documentId, userId]
          );
          try {
            webSocketManager.emitToUser(userId, 'notification:new', {
              module: 'contratual',
              type: 'document.signed',
              title,
              body,
              created_at: new Date().toISOString()
            });
          } catch {}
        }
      } catch (e) {
        console.warn('⚠️ Falha ao notificar documento assinado:', e?.message || e);
      }
    }

    return res.status(200).json({ message: `Evento ${eventType} processado com sucesso.` });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error("Erro no webhook de assinatura:", error);
    return res.status(500).json({ error: "Erro ao processar webhook." });
  } finally {
    if (connection) connection.release();
  }
});


/**
 * 📌 3️⃣ Consultar status do contrato no Autentique
 */
router.get("/:id", verifyToken, async (req, res) => {
  try {
    const doc = await getDocumentAutentique(req.params.id);

    // Calcula status do contrato
    const total = doc.signatures?.length || 0;
    const assinadas = doc.signatures?.filter(s => s.action?.name === "SIGN" && s.link === null)?.length || 0;
    // Aqui, "rejeitado" pode ser detectado por action=null ou ausência de link dependendo do Autentique
    const rejeitadas = doc.signatures?.filter(s => !s.action && !s.link)?.length || 0;

    let statusGeral = "pendente";
    if (rejeitadas > 0) statusGeral = "rejeitado";
    else if (total > 0 && assinadas === total) statusGeral = "assinado";

    res.json({
      ...doc,
      status: statusGeral
    });
  } catch (err) {
    console.error("❌ Erro ao buscar contrato no Autentique:", err);
    res.status(500).json({ error: "Erro ao buscar contrato no Autentique" });
  }
});


// DELETE /documentos-autentique/:documentId
router.delete("/:documentId", verifyToken, async (req, res) => {
  const documentId = req.params.documentId;

  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    // 1) Busca contrato local
    const [[document]] = await connection.query(
      `SELECT id, autentique_id FROM documentos WHERE id = ?`,
      [documentId]
    );

    if (!document) {
      await connection.rollback();
      return res.status(404).json({ error: "Contrato não encontrado." });
    }

    const autentiqueId = document.autentique_id;
    
    // 1.5) Deletar registros relacionados ANTES do documento (respeitar foreign keys)
    // Ordem: assinaturas -> signatarios -> documentos
    await connection.query(`DELETE FROM assinaturas WHERE documento_id = ?`, [documentId]);
    await connection.query(`DELETE FROM signatarios WHERE documento_id = ?`, [documentId]);
    
    if (!autentiqueId) {
      // Se não houver autentique_id, só remove local
      await connection.query(`DELETE FROM documentos WHERE id = ?`, [documentId]);
      await connection.commit();
      return res.status(200).json({ message: "Contrato removido localmente (sem autentique_id)." });
    }

    // 2) Remove no Autentique (doc: deleteDocument)
    // Obs: se tiver assinaturas, o Autentique "move para lixeira" em vez de deletar de vez.
    // Isso é o comportamento esperado da API.
    await deleteDocumentAutentique(autentiqueId);

    // 3) Remove/arquiva localmente (escolha: delete físico ou soft delete)
    // a) Delete físico:
    await connection.query(`DELETE FROM documentos WHERE id = ?`, [documentId]);

    // b) (alternativa) Soft delete:
    // await connection.query(`UPDATE documentos SET status = 'deletado', deleted_at = NOW() WHERE id = ?`, [documentId]);

    await connection.commit();

    return res.status(200).json({
      message: "Contrato excluído no Autentique e removido do sistema.",
      autentique_id: autentiqueId,
      document_id: documentId
    });
  } catch (err) {
    if (connection) await connection.rollback();
    console.error("❌ Erro ao excluir contrato:", err);
    return res.status(500).json({ error: "Erro ao excluir contrato." });
  } finally {
    if (connection) connection.release();
  }
});


/**
 * 4️⃣ Listar URLs de download do Autentique (original/signed/certificado)
 * GET /documentos-autentique/:id/files
 */
router.get("/:id/files", verifyToken, async (req, res) => {
  try {
    const doc = await getDocumentFiles(req.params.id);
    const files = { ...(doc.files || {}) };

    // ✅ Mantém pades intacto e cria o alias certificado baseado no pades
    const certificado = files.pades ? fixPadesUrl(files.pades) : null;

    return res.json({
      id: doc.id,
      name: doc.name,
      files: { ...files, certificado }, // agora temos: original, signed, pades e certificado
    });
  } catch (err) {
    console.error("❌ Erro ao obter URLs do documento:", err);
    return res.status(500).json({ error: "Erro ao obter URLs do documento." });
  }
});




/**
 * 5️⃣ Baixar o PDF (stream) diretamente
 * GET /documentos-autentique/:id/download?type=signed|original|pades
 * - default: signed
 */
router.get("/:id/download", verifyToken, async (req, res) => {
  try {
    const type = String(req.query.type || "signed").toLowerCase();

    // ✅ agora aceita "certificado" também
    if (!["signed", "original", "pades", "certificado"].includes(type)) {
      return res.status(400).json({ error: "Parâmetro 'type' inválido. Use signed|original|pades|certificado." });
    }

    const doc = await getDocumentFiles(req.params.id);

    // ✅ escolhe a URL correta
    let url;
    if (type === "certificado") {
      url = doc?.files?.pades ? fixPadesUrl(doc.files.pades) : null; // usa o pades→certificado
    } else {
      url = doc?.files?.[type]; // signed | original | pades (como veio)
    }

    if (!url) {
      return res.status(404).json({ error: `Arquivo '${type}' indisponível para este documento.` });
    }

    const safeName = (doc.name || "documento").replace(/[^\w\-]+/g, "_");
    const suffix = type; // certificado => "certificado"; pades => "pades"; etc.

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${safeName}_${suffix}.pdf"`);
    res.setHeader("Access-Control-Expose-Headers", "Content-Disposition");

    // 🔽 stream com axios
    const upstream = await axios.get(url, {
      responseType: "stream",
      headers: {
        Accept: "application/pdf",
        ...(process.env.AUTENTIQUE_TOKEN ? { Authorization: `Bearer ${process.env.AUTENTIQUE_TOKEN}` } : {}),
        "User-Agent": "Contabhub/1.0",
      },
      maxRedirects: 10,
      validateStatus: () => true,
    });

    if (upstream.status !== 200) {
      return res.status(upstream.status).json({ error: `Falha ao baixar '${suffix}' (${upstream.status}).` });
    }

    upstream.data.pipe(res);
  } catch (err) {
    console.error("❌ Erro no download do PDF:", err);
    return res.status(500).json({ error: "Erro ao baixar PDF." });
  }
});




module.exports = router;
