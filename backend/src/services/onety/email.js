const nodemailer = require("nodemailer");
require("dotenv").config();

// Configurar o transporte do e-mail
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
});

// Função para enviar o e-mail
const sendEmail = async (to, subject, text, html) => {
  try {
    const info = await transporter.sendMail({
      from: `"Suporte Aura8" <${process.env.SMTP_USER}>`,
      to,
      subject,
      text,
      html,
    });

    console.log("E-mail enviado:", info.messageId);
    return true;
  } catch (error) {
    console.error("Erro ao enviar e-mail:", error);
    return false;
  }
};

module.exports = sendEmail;
