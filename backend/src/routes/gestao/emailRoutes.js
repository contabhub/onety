const express = require("express");
const path = require("path");
try {
  // Garante carregamento do .env caso o servidor não tenha carregado
  if (!process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
    const rootEnv = path.resolve(__dirname, "../../../.env");
    const backendEnv = path.resolve(__dirname, "../../.env");
    require("dotenv").config({ path: backendEnv });
    if (!process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
      require("dotenv").config({ path: rootEnv });
    }
  }
} catch {}
const router = express.Router();
const nodemailer = require("nodemailer");
const multer = require("multer");
const db = require("../../config/database");
const autenticarToken = require("../../middlewares/auth");

const upload = multer(); // usa memória RAM

router.post("/enviar", autenticarToken, upload.array("anexo"), async (req, res) => {
  // LOG de entrada
  try {
    const safeHeaders = {
      authorization: req.headers.authorization ? 'Bearer ***' : undefined,
      'x-empresa-id': req.headers['x-empresa-id'] || req.headers['X-Empresa-Id'] || undefined,
      'content-type': req.headers['content-type']
    };
    console.log('[EMAIL ENVIAR] IN', { url: req.originalUrl, method: req.method, headers: safeHeaders });
  } catch {}

const {
  para,
  cc,
  co,
  assunto,
  corpo,
  nomeUsuario = "Titan App",
  emailUsuario = null,
  obrigacaoId,
  tarefaId,
  empresaId,
} = req.body;

// Tratar emailUsuario que pode vir como JSON stringificado
let emailUsuarioProcessado = emailUsuario;
if (emailUsuario && typeof emailUsuario === 'string') {
  try {
    console.log('[EMAIL ENVIAR] body', { para, cc, co, assunto, obrigacaoId, tarefaId, empresaId: empresaId || req.usuario?.empresaId });
    console.log('[EMAIL ENVIAR] files', (req.files || []).map(f => ({ name: f.originalname, size: f.size })));
    // Se parece ser um JSON, tenta fazer parse
    if (emailUsuario.startsWith('{') || emailUsuario.startsWith('[')) {
      const parsed = JSON.parse(emailUsuario);
      // Se o parsed tem propriedade email, usa ela
      if (parsed && typeof parsed === 'object' && parsed.email) {
        emailUsuarioProcessado = parsed.email;
      }
    }
  } catch (error) {
    // Mantém original se não for JSON válido
  }
}

if (!para || !assunto || !corpo || (!obrigacaoId && !tarefaId)) {
  return res.status(400).json({ error: "Campos obrigatórios ausentes" });
}


  try {
    const attachments = (req.files || []).map((file) => ({
      filename: file.originalname,
      content: file.buffer,
    }));

    // Buscar nome da empresa para usar no "from"
    let nomeEmpresa = null;
    if (empresaId) {
      try {
        const [[empresa]] = await db.query(
          `SELECT razaoSocial FROM empresas WHERE id = ?`,
          [empresaId]
        );
        if (empresa && empresa.razaoSocial) {
          nomeEmpresa = empresa.razaoSocial;
        }
      } catch (error) {
        console.error("Erro ao buscar nome da empresa:", error);
      }
    }

    const smtpHost = process.env.SMTP_HOST || process.env.EMAIL_HOST || 'cfcontabilidade.hybriddc.com.br';
    const smtpUser = process.env.SMTP_USER || process.env.EMAIL_USER;
    const smtpPass = process.env.SMTP_PASSWORD || process.env.EMAIL_PASS;

    try {
      console.log('[EMAIL ENVIAR] SMTP CONFIG', {
        host: smtpHost,
        port: 587,
        secure: false,
        user: smtpUser,
        hasPass: Boolean(smtpPass)
      });
    } catch {}

    if (!smtpUser || !smtpPass) {
      return res.status(500).json({ error: 'Configuração SMTP ausente', detail: 'Defina SMTP_USER e SMTP_PASSWORD nas variáveis de ambiente' });
    }

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: 587,
      secure: false,
      auth: { user: smtpUser, pass: smtpPass },
      requireTLS: true,
      family: 4,
      tls: {
        rejectUnauthorized: false,
        servername: smtpHost,
      },
    });

    // valida conexão antes de enviar
    try {
      await transporter.verify();
    } catch (verifyErr) {
      console.error('[EMAIL ENVIAR] SMTP VERIFY ERRO', { message: verifyErr?.message, code: verifyErr?.code, command: verifyErr?.command });
      return res.status(502).json({ error: 'Falha ao conectar no servidor SMTP', detail: verifyErr?.message });
    }

    // Separar destinatários por vírgula
    const destinatarios = para.split(',').map(email => email.trim()).filter(email => email);
    
    // Enviar email individual para cada destinatário
    const promises = destinatarios.map(async (destinatario, index) => {
      const fromName = nomeEmpresa ? `${nomeUsuario} da ${nomeEmpresa}` : nomeUsuario;
      const mailOptions = {
        from: `"${fromName}" <${smtpUser}>`,
        envelope: { from: smtpUser, to: destinatario },
        to: destinatario,
        cc: cc || undefined,
        bcc: co || undefined,
        subject: assunto,
        html: corpo,
        replyTo: emailUsuarioProcessado || smtpUser,
        attachments,
      };

      try {
        await transporter.sendMail(mailOptions);
        return { destinatario, sucesso: true };
      } catch (error) {
        return { destinatario, sucesso: false, erro: error.message };
      }
    });

    const resultados = await Promise.all(promises);
    
    const sucessos = resultados.filter(r => r.sucesso).length;
    const falhas = resultados.filter(r => !r.sucesso);

    // 💾 Registro no banco
const usuarioId = req.usuario?.usuarioId || req.usuario?.id;
    const emailResumo = `
<b>De:</b> ${nomeUsuario} (${emailUsuarioProcessado || "não informado"})<br/>
<b>Para:</b> ${para}<br/>
${cc ? `<b>CC:</b> ${cc}<br/>` : ""}
${co ? `<b>CO:</b> ${co}<br/>` : ""}
<b>Assunto:</b> ${assunto}<br/>
<b>Corpo:</b><br/>${corpo}
    `.trim();

    const anexos = JSON.stringify(attachments.map((a) => a.filename));


    if (obrigacaoId) {
      // Ajuste conforme schema real (snake_case provável). Mantido nomes antigos por compatibilidade.
      await db.query(
        `INSERT INTO comentarios_obrigacao (obrigacaoId, usuarioId, comentario, anexos, tipo, criadoEm)
         VALUES (?, ?, ?, ?, 'email', NOW())`,
        [obrigacaoId, usuarioId, emailResumo, anexos]
      );
    } else if (tarefaId) {
      // Usar snake_case seguro e apenas os parâmetros corretos
      await db.query(
        `INSERT INTO comentarios_tarefa (tarefa_id, usuario_id, comentario, criado_em)
         VALUES (?, ?, ?, NOW())`,
        [tarefaId, usuarioId, emailResumo]
      );
    }



    res.status(200).json({ 
      success: true, 
      message: `E-mail enviado e registrado com sucesso! ${sucessos}/${destinatarios.length} destinatários receberam.`,
      sucessos: sucessos,
      total: destinatarios.length,
      falhas: falhas.length > 0 ? falhas : null
    });
  } catch (err) {
    console.error('[EMAIL ENVIAR] ERRO', { message: err?.message, stack: err?.stack });
    try {
      if (err?.response && err.response.data) {
        console.error('[EMAIL ENVIAR] ERRO DATA', err.response.data);
      }
    } catch {}
    res.status(500).json({ error: "Erro ao enviar e-mail ou salvar comentário.", detail: err?.message });
  }
});

module.exports = router;
