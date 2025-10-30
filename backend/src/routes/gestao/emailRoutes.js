const express = require("express");
const router = express.Router();
const nodemailer = require("nodemailer");
const multer = require("multer");
const db = require("../../config/database");
const autenticarToken = require("../../middlewares/auth");

const upload = multer(); // usa memória RAM

router.post("/enviar", autenticarToken, upload.array("anexo"), async (req, res) => {

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

    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: parseInt(process.env.EMAIL_PORT),
      secure: parseInt(process.env.EMAIL_PORT) === 465,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
      tls: {
        rejectUnauthorized: false,
      },
    });

    // Separar destinatários por vírgula
    const destinatarios = para.split(',').map(email => email.trim()).filter(email => email);
    
    // Enviar email individual para cada destinatário
    const promises = destinatarios.map(async (destinatario, index) => {
      const fromName = nomeEmpresa ? `${nomeUsuario} da ${nomeEmpresa}` : nomeUsuario;
      const mailOptions = {
        from: `"${fromName}" <${process.env.EMAIL_USER}>`,
        to: destinatario,
        cc: cc || undefined,
        bcc: co || undefined,
        subject: assunto,
        html: corpo,
        replyTo: emailUsuarioProcessado || process.env.EMAIL_USER,
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
  await db.query(`
    INSERT INTO comentarios_obrigacao (obrigacaoId, usuarioId, comentario, anexos, tipo, criadoEm)
    VALUES (?, ?, ?, ?, 'email', NOW())
  `, [
    obrigacaoId,
    usuarioId,
    emailResumo,
    anexos,
  ]);
} else if (tarefaId) {
  await db.query(`
    INSERT INTO comentarios_tarefa (tarefaId, usuarioId, comentario, criadoEm)
    VALUES (?, ?, ?, NOW())
  `, [
    tarefaId,
    usuarioId,
    emailResumo,
    anexos,
  ]);
}



    res.status(200).json({ 
      success: true, 
      message: `E-mail enviado e registrado com sucesso! ${sucessos}/${destinatarios.length} destinatários receberam.`,
      sucessos: sucessos,
      total: destinatarios.length,
      falhas: falhas.length > 0 ? falhas : null
    });
  } catch (err) {
    res.status(500).json({ error: "Erro ao enviar e-mail ou salvar comentário." });
  }
});

module.exports = router;
