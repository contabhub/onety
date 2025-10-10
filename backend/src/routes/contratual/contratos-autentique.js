const express = require("express");
const { createDocumentAutentique, getDocumentAutentique, deleteDocumentAutentique, getDocumentFiles } = require("../../services/contratual/autentique");
const db = require("../../config/database"); // conexão MySQL (mysql2/promise)
const verifyToken = require("../../middlewares/auth");
const PdfPrinter = require("pdfmake");
const htmlToPdfmake = require("html-to-pdfmake");
const { JSDOM } = require("jsdom");
const crypto = require("crypto");
const axios = require("axios");


const router = express.Router();

// troca .../pades.pdf (com ou sem querystring) por .../certificado.pdf
function fixPadesUrl(url) {
  if (typeof url !== "string") return url;
  return url.replace(/\/pades\.pdf(\?.*)?$/i, (_m, qs = "") => `/certificado.pdf${qs}`);
}


/**
 * 📌 1️⃣ Rota para HTML com variáveis (converte para PDF e envia para Autentique)
 * Segue a mesma estrutura da rota de contratos.js
 */
router.post("/html", verifyToken, async (req, res) => {
  const {
    template_id,
    client_id,
    signatories,
    variables,
    empresa_id,
    valor,
    valor_recorrente,
    expires_at,
    start_at,
    end_at
  } = req.body;
  const createdBy = req.user.id;

  // Validação dos campos (mesma estrutura do contratos.js)
  if (!template_id || !client_id || !Array.isArray(signatories) || signatories.length === 0 || !empresa_id) {
    return res.status(400).json({ error: "Preencha todos os campos obrigatórios." });
  }

  if (!expires_at) {
    return res.status(400).json({ error: "O campo expires_at é obrigatório." });
  }

  try {
    // 1️⃣ Buscar conteúdo do template (mesmo que contratos.js)
    const [[template]] = await db.query(
      "SELECT conteudo FROM modelos_contrato WHERE id = ?",
      [template_id]
    );

    if (!template) {
      return res.status(404).json({ error: "Template não encontrado." });
    }

    // 2️⃣ Substituir as variáveis no conteúdo do template (mesmo que contratos.js)
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

        // 4️⃣ Criar documento no Autentique com PDF convertido
        const doc = await createDocumentAutentique(
          `Contrato ${template_id}`,
          pdfBase64,
          signatories.map(sig => ({
            name: sig.name,
            cpf: sig.cpf || null
          }))
        );

        // 5️⃣ Criar o contrato no banco (mesma estrutura do contratos.js)
        const [contractResult] = await db.query(
          "INSERT INTO contratos (modelos_contrato_id, conteudo, status, criado_por, pre_cliente_id, expirado_em, comeca_em, termina_em, empresa_id, valor, valor_recorrente, autentique, autentique_id) VALUES (?, ?, 'pendente', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
          [template_id, filledContent, createdBy, client_id, expires_at, start_at, end_at, empresa_id, valor || null, valor_recorrente || null, 1, doc.id]
        );

        const contract_id = contractResult.insertId;

        // 6️⃣ Adicionar múltiplos signatários (mesma estrutura do contratos.js)
        for (const signatory of signatories) {
          const { name, email, cpf, birth_date, telefone, funcao_assinatura } = signatory;
          const token_acesso = crypto.randomBytes(32).toString("hex");
          // Trata string vazia e undefined como null
          const birthDateToSave = birth_date && birth_date.trim() !== "" ? birth_date : null;

          await db.query(
            "INSERT INTO signatarios (contrato_id, nome, email, cpf, data_nascimento, token_acesso, telefone, empresa_id, funcao_assinatura) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [contract_id, name, email, cpf, birthDateToSave, token_acesso, telefone, empresa_id, funcao_assinatura]
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
             WHERE contrato_id = ? AND email = ?`,
            [
              sig.public_id,
              sig.link?.short_link || null,
              contract_id,
              inputData.email
            ]
          );
        }

        res.status(201).json({
          message: "✅ Contrato criado, convertido para PDF e enviado para Autentique",
          contract_id,
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
router.post("/", verifyToken, async (req, res) => {
  try {
    const {
      name,
      content,
      signatories,
      empresa_id,
      created_by,
      valor,
      valor_recorrente,
      client_id,
      start_at,       // ⬅️ novo
      end_at,         // ⬅️ novo
      expires_at      // ⬅️ novo
    } = req.body;

    // 1️⃣ Cria documento no Autentique
    const doc = await createDocumentAutentique(
      name,
      content,
      signatories.map(sig => ({
        name: sig.name,
        cpf: sig.cpf || null
      }))
    );

    // 2️⃣ Salva contrato no banco
    const [contractResult] = await db.query(
      `INSERT INTO contratos (
         autentique, 
         autentique_id, 
         status, 
         conteudo, 
         empresa_id, 
         pre_cliente_id,
         valor,
         valor_recorrente,
         criado_em,
         criado_por,
         comeca_em,
         termina_em,
         expirado_em
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?, ?)`,
      [
        1,                          // autentique
        doc.id,                    // autentique_id
        "pendente",                // status
        content,                   // conteudo
        empresa_id,                // empresa_id
        client_id,                 // pre_cliente_id
        valor || null,             // valor
        valor_recorrente || null,  // valor_recorrente
        created_by,                // criado_por
        start_at || null,          // comeca_em
        end_at || null,            // termina_em
        expires_at || null         // expirado_em
      ]
    );

    const contractId = contractResult.insertId;

    // 3️⃣ Filtra os signatários válidos
    const validSignatures = doc.signatures.filter(sig => sig.action);

    // 4️⃣ Salva os signatários no banco
    for (let i = 0; i < validSignatures.length; i++) {
      const sig = validSignatures[i];
      const inputData = signatories[i];

      await db.query(
        `INSERT INTO signatarios (
           contrato_id, 
           nome, 
           email, 
           public_id, 
           token_acesso, 
           cpf, 
           telefone
         )
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          contractId,
          sig.name || "",
          inputData.email || "",
          sig.public_id,
          sig.link?.short_link || null,
          inputData.cpf || null,
          inputData.phone || null
        ]
      );
    }

    res.json({
      message: "✅ Contrato PDF criado e salvo com datas",
      autentique_id: doc.id,
      contract_id: contractId
    });

  } catch (err) {
    console.error("❌ Erro ao criar contrato PDF:", err);
    res.status(500).json({ error: "Erro ao criar contrato PDF" });
  }
});


// POST /contratos-autentique/webhook-dados-assinatura
router.post("/webhook-dados-assinatura", async (req, res) => {
  const { event } = req.body;

  console.log("🔔 Webhook recebido:", {
    eventType: event.type,
    autentiqueId: event.data.document,
    cpf: event.data.cpf,
    user: event.data.user,
  });

  const eventType = event.type;
  const eventData = event.data;

  const autentiqueId = eventData.document; // ID do documento no Autentique
  const isRejection = eventType === "signature.rejected";

  // Campos que só fazem sentido para assinatura
  const ip = eventData.events?.find((e) => e.type === "signed")?.ip || null;
  const userAgent = req.headers["user-agent"] || "Autentique Webhook";
  const signedAt = new Date(eventData.signed || new Date());

  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    // 1) Encontrar alvo (contrato OU documento) pelo autentique_id
    let scope = { table: "contratos", fk: "contrato_id", id: null };

    const [[c]] = await connection.query(
      `SELECT id FROM contratos WHERE autentique_id = ?`,
      [autentiqueId]
    );

    console.log("🔍 Busca contrato:", { 
      autentiqueId, 
      contratosFound: !!c, 
      contratoId: c?.id 
    });

    if (c) {
      scope.id = c.id;
    } else {
      // Debug: verificar se existe algum contrato com autentique_id similar
      const [debugContratos] = await connection.query(
        `SELECT id, autentique_id FROM contratos WHERE autentique_id LIKE ? OR autentique_id LIKE ?`,
        [`%${autentiqueId.substring(0, 10)}%`, `%${autentiqueId.substring(-10)}%`]
      );
      console.log("🔍 Debug - Contratos similares:", debugContratos);
      const [[d]] = await connection.query(
        `SELECT id FROM documentos WHERE autentique_id = ?`,
        [autentiqueId]
      );
      if (!d) {
        await connection.rollback();
        return res
          .status(404)
          .json({ error: "Contrato/Documento não encontrado no sistema." });
      }
      scope = { table: "documentos", fk: "documento_id", id: d.id };
    }

    const recordId = scope.id;
    console.log("📋 Alvo encontrado:", { table: scope.table, id: recordId });

    // --- CASO: REJEIÇÃO (não mexe em signatures) ---
    if (isRejection) {
      const cpfRaw = eventData.user?.cpf || eventData.cpf;
      let signatoryId = null;

      if (cpfRaw) {
        // busca direta
        let [[signatory]] = await connection.query(
          `SELECT id FROM signatarios WHERE ${scope.fk} = ? AND cpf = ?`,
          [recordId, cpfRaw]
        );

        // busca sem formatação
        if (!signatory) {
          const cpfOnlyNumbers = String(cpfRaw).replace(/\D/g, "");
          [[signatory]] = await connection.query(
            `SELECT id FROM signatarios 
             WHERE ${scope.fk} = ? 
               AND REPLACE(REPLACE(REPLACE(cpf, '.', ''), '-', ''), ' ', '') = ?`,
            [recordId, cpfOnlyNumbers]
          );
        }

        if (signatory) signatoryId = signatory.id;
      }

      await connection.query(
        `UPDATE ${scope.table} SET status = 'reprovado', rejected_by = ? WHERE id = ?`,
        [signatoryId, recordId]
      );

      // 🔗 Se for contrato, atualizar o lead relacionado para fase "Perdeu" e status 'perdeu'
      if (scope.table === 'contratos') {
        // Busca pre_cliente_id do contrato → lead_id do cliente → funil do lead → fase "Perdeu"
        const [[contrato]] = await connection.query(
          `SELECT pre_cliente_id FROM contratos WHERE id = ?`,
          [recordId]
        );
        if (contrato?.pre_cliente_id) {
          const [[cliente]] = await connection.query(
            `SELECT lead_id FROM pre_clientes WHERE id = ?`,
            [contrato.pre_cliente_id]
          );
          if (cliente?.lead_id) {
            const [[lead]] = await connection.query(
              `SELECT id, funil_id FROM leads WHERE id = ?`,
              [cliente.lead_id]
            );
            if (lead?.funil_id) {
              const [[fasePerdeu]] = await connection.query(
                `SELECT id FROM funil_fases WHERE funil_id = ? AND nome = 'Perdeu'`,
                [lead.funil_id]
              );
              if (fasePerdeu?.id) {
                await connection.query(
                  `UPDATE leads SET fase_funil_id = ?, status = 'perdeu' WHERE id = ?`,
                  [fasePerdeu.id, lead.id]
                );
              } else {
                // Fallback: apenas status
                await connection.query(
                  `UPDATE leads SET status = 'perdeu' WHERE id = ?`,
                  [lead.id]
                );
              }
            }
          }
        }
      }

      await connection.commit();
      return res.status(200).json({
        message: `Evento ${eventType} processado (rejeição sem inserir em assinaturas).`,
      });
    }

    // --- CASO: ASSINATURA ---
    const cpf = eventData.user?.cpf || eventData.cpf;
    if (!cpf) {
      await connection.rollback();
      return res
        .status(400)
        .json({ error: "CPF do signatário é obrigatório para registrar assinatura." });
    }

    // 2) Buscar signatário (com busca flexível)
    let [[signatory]] = await connection.query(
      `SELECT id FROM signatarios WHERE ${scope.fk} = ? AND cpf = ?`,
      [recordId, cpf]
    );

    if (!signatory) {
      const cpfOnlyNumbers = String(cpf).replace(/\D/g, "");
      [[signatory]] = await connection.query(
        `SELECT id FROM signatarios 
         WHERE ${scope.fk} = ? 
           AND REPLACE(REPLACE(REPLACE(cpf, '.', ''), '-', ''), ' ', '') = ?`,
        [recordId, cpfOnlyNumbers]
      );
    }

    console.log("🔍 Busca signatário:", {
      target: scope.table,
      id: recordId,
      cpf,
      signatoryFound: !!signatory,
    });

    if (!signatory) {
      const [allSignatories] = await connection.query(
        `SELECT id, nome, email, cpf FROM signatarios WHERE ${scope.fk} = ?`,
        [recordId]
      );

      console.log("🔍 Debug - Todos os signatários do alvo:", allSignatories);
      console.log("🔍 Debug - CPF procurado:", cpf);

      await connection.rollback();
      return res.status(404).json({
        error: "Signatário não encontrado.",
        debug: { target: scope.table, id: recordId, cpf, availableSignatories: allSignatories },
      });
    }

    const signatoryId = signatory.id;

    // Evitar duplicidade
    const [[existingSignature]] = await connection.query(
      `SELECT id FROM assinaturas WHERE ${scope.fk} = ? AND signatario_id = ?`,
      [recordId, signatoryId]
    );
    if (existingSignature) {
      await connection.rollback();
      return res.status(200).json({ message: "Assinatura já registrada." });
    }

    // Inserir assinatura
    const hashBase = `${cpf}-${recordId}-${ip}`;
    const hash = crypto.createHash("sha256").update(hashBase).digest("hex");

    await connection.query(
      `INSERT INTO assinaturas (${scope.fk}, signatario_id, cpf, assinado_em, endereco_ip, navegador_usuario, hash)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [recordId, signatoryId, cpf, signedAt, ip, userAgent, hash]
    );

    await connection.query(
      `UPDATE signatarios SET assinado_em = ? WHERE id = ?`,
      [signedAt, signatoryId]
    );

    // Se todos assinaram, marca como assinado
    const [[{ total }]] = await connection.query(
      `SELECT COUNT(*) as total FROM signatarios WHERE ${scope.fk} = ?`,
      [recordId]
    );
    const [[{ assinados }]] = await connection.query(
      `SELECT COUNT(*) as assinados FROM signatarios WHERE ${scope.fk} = ? AND assinado_em IS NOT NULL`,
      [recordId]
    );
    
    let contratoCompletamenteAssinado = false;
    if (assinados === total) {
      await connection.query(
        `UPDATE ${scope.table} SET status = 'assinado' WHERE id = ?`,
        [recordId]
      );
      contratoCompletamenteAssinado = true;
    }

    // 🔗 Se for contrato completamente assinado, atualizar lead: fase "Ganhou" e status 'ganhou'
    if (contratoCompletamenteAssinado && scope.table === 'contratos') {
      const [[contrato]] = await connection.query(
        `SELECT pre_cliente_id FROM contratos WHERE id = ?`,
        [recordId]
      );
      if (contrato?.pre_cliente_id) {
        const [[cliente]] = await connection.query(
          `SELECT lead_id FROM pre_clientes WHERE id = ?`,
          [contrato.pre_cliente_id]
        );
        if (cliente?.lead_id) {
          const [[lead]] = await connection.query(
            `SELECT id, funil_id FROM leads WHERE id = ?`,
            [cliente.lead_id]
          );
          if (lead?.funil_id) {
            const [[faseGanhou]] = await connection.query(
              `SELECT id FROM funil_fases WHERE funil_id = ? AND nome = 'Ganhou'`,
              [lead.funil_id]
            );
            if (faseGanhou?.id) {
              await connection.query(
                `UPDATE leads SET fase_funil_id = ?, status = 'ganhou' WHERE id = ?`,
                [faseGanhou.id, lead.id]
              );
            } else {
              // Fallback: apenas status
              await connection.query(
                `UPDATE leads SET status = 'ganhou' WHERE id = ?`,
                [lead.id]
              );
            }
          }
        }
      }
    }

    await connection.commit();
    
    // Se o contrato foi completamente assinado, enviar notificações por email
    if (contratoCompletamenteAssinado && scope.table === 'contratos') {
      try {
        console.log("📧 Contrato completamente assinado, enviando notificações...");
        
        // Fazer requisição para a rota de notificação
        const baseUrl = process.env.API_BASE_URL || 'http://localhost:3001';
        const notificationResponse = await fetch(`${baseUrl}/contratos/${recordId}/notificar-assinatura`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
        if (notificationResponse.ok) {
          const notificationResult = await notificationResponse.json();
          console.log("✅ Notificações enviadas com sucesso:", notificationResult.detalhes);
        } else {
          console.error("❌ Erro ao enviar notificações:", await notificationResponse.text());
        }
      } catch (emailError) {
        console.error("❌ Erro ao processar notificações por email:", emailError);
        // Não falha o webhook por erro de email
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


// DELETE /contratos-autentique/:contractId
router.delete("/:contractId", verifyToken, async (req, res) => {
  const contractId = req.params.contractId;

  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    // 1) Busca contrato local
    const [[contract]] = await connection.query(
      `SELECT id, autentique_id FROM contratos WHERE id = ?`,
      [contractId]
    );

    if (!contract) {
      await connection.rollback();
      return res.status(404).json({ error: "Contrato não encontrado." });
    }

    const autentiqueId = contract.autentique_id;
    if (!autentiqueId) {
      // Se não houver autentique_id, só remove local
      await connection.query(`DELETE FROM contratos WHERE id = ?`, [contractId]);
      await connection.commit();
      return res.status(200).json({ message: "Contrato removido localmente (sem autentique_id)." });
    }

    // 2) Remove no Autentique (doc: deleteDocument)
    // Obs: se tiver assinaturas, o Autentique "move para lixeira" em vez de deletar de vez.
    // Isso é o comportamento esperado da API. :contentReference[oaicite:3]{index=3}
    await deleteDocumentAutentique(autentiqueId);

    // 3) Remove/arquiva localmente (escolha: delete físico ou soft delete)
    // a) Delete físico:
    await connection.query(`DELETE FROM contratos WHERE id = ?`, [contractId]);

    // b) (alternativa) Soft delete:
    // await connection.query(`UPDATE contratos SET status = 'deletado', deleted_at = NOW() WHERE id = ?`, [contractId]);

    await connection.commit();

    return res.status(200).json({
      message: "Contrato excluído no Autentique e removido do sistema.",
      autentique_id: autentiqueId,
      contract_id: contractId
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
 * GET /contratos-autentique/:id/files
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
 * GET /contratos-autentique/:id/download?type=signed|original|pades
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
