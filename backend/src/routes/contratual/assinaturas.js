const express = require("express");
const pool = require("../../config/database");
const crypto = require("crypto");

const router = express.Router();

// Rota para assinar um contrato usando o token de acesso
router.post("/:access_token/sign", async (req, res) => {
  const { access_token } = req.params;
  const { cpf } = req.body;
  const ip_address = req.ip;
  const user_agent = req.headers["user-agent"];

  let connection;

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction(); // 🔒 Iniciar transação para garantir consistência

    // 🔹 1. Buscar signatário e contrato pelo token de acesso do signatário
    const [contract] = await connection.query(
      `SELECT c.id as contract_id, c.status, c.data_expiracao, s.id as signatario_id 
       FROM contratos c 
       JOIN signatarios s ON c.id = s.contrato_id 
       WHERE s.token_acesso = ? AND s.cpf = ?`,
      [access_token, cpf]
    );

    if (contract.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: "Contrato não encontrado ou CPF inválido." });
    }

    // 🔹 2. Verificar se o contrato já expirou
    if (contract[0].data_expiracao && new Date(contract[0].data_expiracao) < new Date()) {
      await connection.rollback();
      return res.status(403).json({ error: "Este contrato já expirou e não pode ser assinado." });
    }

    if (contract[0].status === "assinado") {
      await connection.rollback();
      return res.status(403).json({ error: "Este contrato já foi assinado." });
    }

    // 🔹 3. Gerar hash da assinatura (baseado no CPF, contrato e IP)
    const hash = crypto.createHash("sha256").update(`${cpf}-${contract[0].contract_id}-${ip_address}`).digest("hex");

    // 🔹 Verificar se este signatário já assinou antes de permitir uma nova assinatura
    const [[existingSignature]] = await connection.query(
      "SELECT id FROM assinaturas WHERE contrato_id = ? AND signatario_id = ?",
      [contract[0].contract_id, contract[0].signatario_id]
    );

    if (existingSignature) {
      await connection.rollback();
      return res.status(400).json({ error: "Este signatário já assinou este contrato." });
    }

    // 🔹 Se não assinou ainda, registrar assinatura
    await connection.query(
      "INSERT INTO assinaturas (contrato_id, documento_id, signatario_id, cpf, assinado_em, endereco_ip, navegador_usuario, hash) VALUES (?, ?, ?, ?, NOW(), ?, ?, ?)",
      [contract[0].contract_id, null, contract[0].signatario_id, cpf, ip_address, user_agent, hash]
    );


    // 🔹 5. Atualizar o assinado_em na tabela signatarios para marcar que esse signatário assinou
    await connection.query(
      "UPDATE signatarios SET assinado_em = NOW() WHERE id = ? AND contrato_id = ?",
      [contract[0].signatario_id, contract[0].contract_id]
    );

    // 🔹 6. Contar o total de signatários do contrato
    const [[{ total }]] = await connection.query(
      "SELECT COUNT(*) as total FROM signatarios WHERE contrato_id = ?",
      [contract[0].contract_id]
    );

    // 🔹 7. Contar quantos signatários já assinaram
    const [[{ assinados }]] = await connection.query(
      "SELECT COUNT(*) as assinados FROM signatarios WHERE contrato_id = ? AND assinado_em IS NOT NULL",
      [contract[0].contract_id]
    );

    // 🔹 8. Se TODOS os signatários assinaram, marcar o contrato como "assinado" e preencher data_assinatura
    let contratoCompletamenteAssinado = false;
    if (assinados === total) {
      await connection.query(
        "UPDATE contratos SET status = 'assinado', data_assinatura = NOW() WHERE id = ?", 
        [contract[0].contract_id]
      );
      contratoCompletamenteAssinado = true;
    }

    // 🎯 CONVERTER PRE_CLIENTE EM CLIENTE E ATUALIZAR CONTRATO (se straton = 1)
    if (contratoCompletamenteAssinado) {
      const [[contrato]] = await connection.query(
        `SELECT c.pre_cliente_id, c.cliente_id, c.modelos_contrato_id, mc.straton
         FROM contratos c
         LEFT JOIN modelos_contrato mc ON c.modelos_contrato_id = mc.id
         WHERE c.id = ?`,
        [contract[0].contract_id]
      );

      if (contrato?.pre_cliente_id && !contrato.cliente_id) {
        console.log("🔄 Convertendo pre_cliente para cliente...");
        // Importar função dinamicamente para evitar dependência circular
        const { converterPreClienteParaCliente } = require('./contratos-autentique');
        const clienteId = await converterPreClienteParaCliente(contrato.pre_cliente_id, connection);
        
        if (clienteId) {
          await connection.query(
            `UPDATE contratos SET cliente_id = ? WHERE id = ?`,
            [clienteId, contract[0].contract_id]
          );
          console.log("✅ Contrato atualizado com cliente_id:", clienteId);
        }
      }

      // 🎯 CRIAR VENDAS BASEADAS EM PRODUTOS_DADOS SE STRATON = 1
      if (contrato?.straton === 1) {
        const { criarVendasDeProdutosDados } = require('./contratos-autentique');
        await criarVendasDeProdutosDados(contract[0].contract_id, connection);
      }
    }




    // 🔄 Atualizar o lead para fase "Ganhou" (se existir)
    const [[client]] = await connection.query(
      "SELECT lead_id FROM pre_clientes WHERE id = (SELECT cliente_id FROM contratos WHERE id = ?)",
      [contract[0].contract_id]
    );

    if (client && client.lead_id) {
      const [[lead]] = await connection.query(
        "SELECT funil_id FROM leads WHERE id = ?",
        [client.lead_id]
      );

      if (lead && lead.funil_id) {
        const [[faseGanhou]] = await connection.query(
          "SELECT id FROM funil_fases WHERE funil_id = ? AND nome = 'Ganhou'",
          [lead.funil_id]
        );

        if (faseGanhou) {
          await connection.query(
            "UPDATE leads SET funil_fase_id = ?, status = 'ganhou' WHERE id = ?",
            [faseGanhou.id, client.lead_id]
          );
        }
      }
    }


    


    await connection.commit(); // ✅ Confirmar todas as operações no banco

    res.status(201).json({ message: "Contrato assinado com sucesso!", hash });

  } catch (error) {
    if (connection) await connection.rollback(); // 🔄 Reverter mudanças em caso de erro
    console.error("Erro ao assinar contrato:", error);
    res.status(500).json({ error: "Erro ao assinar contrato." });
  } finally {
    if (connection) connection.release(); // 🔄 Liberar conexão
  }
});


// Rota para rejeitar um contrato
router.post("/:access_token/reject", async (req, res) => {
  const { access_token } = req.params;
  const { cpf } = req.body;
  const ip_address = req.ip;
  const user_agent = req.headers["user-agent"];

  let connection;

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    // 🔍 Buscar o signatário e contrato pelo access_token
    const [contract] = await connection.query(
      `SELECT c.id as contract_id, c.status, c.data_expiracao, s.id as signatario_id 
       FROM contratos c 
       JOIN signatarios s ON c.id = s.contrato_id 
       WHERE s.token_acesso = ? AND s.cpf = ?`,
      [access_token, cpf]
    );

    if (contract.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: "Contrato não encontrado ou CPF inválido." });
    }

    // Impedir rejeição se contrato já tiver sido assinado, expirado ou reprovado
    const currentStatus = contract[0].status;
    if (["assinado", "expirado", "reprovado"].includes(currentStatus)) {
      await connection.rollback();
      return res.status(400).json({ error: `Contrato não pode ser reprovado. Status atual: ${currentStatus}` });
    }

    // Verificar se este signatário já rejeitou/assinou
    const [[existing]] = await connection.query(
      `SELECT id FROM assinaturas WHERE contrato_id = ? AND signatario_id = ?`,
      [contract[0].contract_id, contract[0].signatario_id]
    );

    if (existing) {
      await connection.rollback();
      return res.status(400).json({ error: "Este signatário já respondeu este contrato." });
    }

    // Rejeitar o contrato:
    // 1. Inserir assinatura como "rejeição"
    const hash = crypto.createHash("sha256").update(`${cpf}-${contract[0].contract_id}-${ip_address}-rejeitado`).digest("hex");

    await connection.query(
      `INSERT INTO assinaturas (contrato_id, documento_id, signatario_id, cpf, assinado_em, endereco_ip, navegador_usuario, hash)
       VALUES (?, ?, ?, ?, NOW(), ?, ?, ?)`,
      [contract[0].contract_id, null, contract[0].signatario_id, cpf, ip_address, user_agent, hash]
    );

    // 2. Atualizar o contrato como reprovado
    await connection.query(
      `UPDATE contratos SET status = 'reprovado' WHERE id = ?`,
      [contract[0].contract_id]
    );



// 🔄 Atualizar o lead para fase "Perdeu" (se existir)
const [[client]] = await connection.query(
  "SELECT lead_id FROM pre_clientes WHERE id = (SELECT cliente_id FROM contratos WHERE id = ?)",
  [contract[0].contract_id]
);

if (client && client.lead_id) {
  const [[lead]] = await connection.query(
    "SELECT funil_id FROM leads WHERE id = ?",
    [client.lead_id]
  );

  if (lead && lead.funil_id) {
    const [[fasePerdeu]] = await connection.query(
      "SELECT id FROM funil_fases WHERE funil_id = ? AND nome = 'Perdeu'",
      [lead.funil_id]
    );

    if (fasePerdeu) {
      await connection.query(
        "UPDATE leads SET funil_fase_id = ?, status = 'perdeu' WHERE id = ?",
        [fasePerdeu.id, client.lead_id]
      );
    }
  }
}




    await connection.commit();

    return res.status(200).json({ message: "Contrato reprovado com sucesso." });

  } catch (err) {
    if (connection) await connection.rollback();
    console.error("Erro ao reprovar contrato:", err);
    res.status(500).json({ error: "Erro ao reprovar contrato." });
  } finally {
    if (connection) connection.release();
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




module.exports = router;
