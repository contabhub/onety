const nodemailer = require('nodemailer');
require('dotenv').config();

// Configuração do transporter do nodemailer
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: 587, // Porta padrão para SMTP com TLS
  secure: false, // true para 465, false para outras portas
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD
  }
});

// Função para enviar email
const sendEmail = async (options) => {
  try {
    // Suporte tanto para objeto quanto para parâmetros separados
    let mailOptions;
    
    if (typeof options === 'object' && options.to) {
      // Formato objeto: { to, subject, text, html }
      mailOptions = {
        from: process.env.SMTP_USER,
        to: options.to,
        subject: options.subject,
        text: options.text || '',
        html: options.html || ''
      };
    } else {
      // Formato antigo: sendEmail(to, subject, text, html)
      const [to, subject, text, html] = arguments;
      mailOptions = {
        from: process.env.SMTP_USER,
        to: to,
        subject: subject,
        text: text || '',
        html: html || ''
      };
    }

    // Validação básica
    if (!mailOptions.to) {
      throw new Error('No recipients defined');
    }

    const result = await transporter.sendMail(mailOptions);
    console.log('Email enviado com sucesso:', result.messageId);
    return result;
  } catch (error) {
    console.error('Erro ao enviar email:', error);
    throw error;
  }
};

module.exports = { sendEmail };
