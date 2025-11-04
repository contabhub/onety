const nodemailer = require("nodemailer");
const db = require("../../config/database");

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransport({
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
  }

  /**
   * Notifica responsáveis de subtarefas quando uma tarefa principal é criada
   * @param {Object} tarefaPai - Dados da tarefa pai
   * @param {Array} subtarefas - Array de subtarefas criadas
   * @param {Object} usuarioCriador - Dados do usuário que criou a tarefa
   */
  async notificarResponsaveisSubtarefas(tarefaPai, subtarefas, usuarioCriador) {
    try {
      console.log("📧 Iniciando notificação de responsáveis de subtarefas...");
      
      // Buscar dados do cliente
      const [[cliente]] = await db.query(
        `SELECT razao_social AS nome, cpf_cnpj AS cnpjCpf FROM clientes WHERE id = ?`,
        [tarefaPai.clienteId]
      );

      // Buscar dados da empresa
      const [[empresa]] = await db.query(
        `SELECT razaoSocial, logo_url FROM empresas WHERE id = ?`,
        [tarefaPai.empresaId]
      );

      // Buscar dados do departamento
      const [[departamento]] = await db.query(
        `SELECT nome FROM departamentos WHERE id = ?`,
        [tarefaPai.departamentoId]
      );

      // Agrupar subtarefas por responsável
      const responsaveis = {};
      
      for (const subtarefa of subtarefas) {
        if (subtarefa.responsavelId && subtarefa.responsavelId !== tarefaPai.responsavelId) {
          if (!responsaveis[subtarefa.responsavelId]) {
            // Buscar dados do responsável
            const [[responsavel]] = await db.query(
              `SELECT nome, email FROM usuarios WHERE id = ?`,
              [subtarefa.responsavelId]
            );
            
            if (responsavel && responsavel.email) {
              responsaveis[subtarefa.responsavelId] = {
                nome: responsavel.nome,
                email: responsavel.email,
                subtarefas: []
              };
            }
          }
          
          if (responsaveis[subtarefa.responsavelId]) {
            responsaveis[subtarefa.responsavelId].subtarefas.push(subtarefa);
          }
        }
      }

      // Buscar dados do responsável da tarefa pai para reply-to
      let replyToEmail = usuarioCriador.email;
      if (!replyToEmail && tarefaPai.responsavelId) {
        const [[responsavelPai]] = await db.query(
          `SELECT email FROM usuarios WHERE id = ?`,
          [tarefaPai.responsavelId]
        );
        if (responsavelPai && responsavelPai.email) {
          replyToEmail = responsavelPai.email;
        }
      }

      // Enviar e-mails para cada responsável
      for (const [responsavelId, dados] of Object.entries(responsaveis)) {
        await this.enviarEmailSubtarefa(
          dados.email,
          dados.nome,
          tarefaPai,
          dados.subtarefas,
          cliente,
          empresa,
          departamento,
          usuarioCriador,
          replyToEmail
        );
      }

      console.log("✅ Notificações enviadas com sucesso!");
    } catch (error) {
      console.error("❌ Erro ao notificar responsáveis de subtarefas:", error);
      throw error;
    }
  }

  /**
   * Notifica responsável principal quando uma tarefa é criada
   * @param {Object} tarefa - Dados da tarefa criada
   * @param {Object} responsavel - Dados do responsável
   * @param {Object} usuarioCriador - Dados do usuário que criou a tarefa
   * @param {String} nomeEmpresa - Nome da empresa
   */
  async notificarResponsavelPrincipal(tarefa, responsavel, usuarioCriador, nomeEmpresa) {
    try {
      console.log("📧 Iniciando notificação do responsável principal...");
      
      // Buscar dados do cliente
      const [[cliente]] = await db.query(
        `SELECT razao_social AS nome, cpf_cnpj AS cnpjCpf FROM clientes WHERE id = ?`,
        [tarefa.clienteId]
      );

      // Buscar dados da empresa
      const [[empresa]] = await db.query(
        `SELECT razaoSocial, logo_url FROM empresas WHERE id = ?`,
        [tarefa.empresaId]
      );

      // Buscar dados do departamento
      const [[departamento]] = await db.query(
        `SELECT nome FROM departamentos WHERE id = ?`,
        [tarefa.departamentoId]
      );

      // Buscar dados do processo
      const [[processo]] = await db.query(
        `SELECT nome FROM processos WHERE id = ?`,
        [tarefa.processoId]
      );

      // Enviar e-mail para o responsável principal
      await this.enviarEmailResponsavelPrincipal(
        responsavel.email,
        responsavel.nome,
        tarefa,
        cliente,
        empresa,
        departamento,
        processo,
        usuarioCriador
      );

      console.log("📧 Notificação do responsável principal enviada com sucesso!");
    } catch (error) {
      console.error("❌ Erro ao enviar notificação do responsável principal:", error);
      throw error;
    }
  }

  /**
   * Notifica sobre conclusão de tarefa
   * @param {Object} tarefa - Dados da tarefa concluída
   * @param {Object} usuarioQueFinalizou - Dados do usuário que finalizou
   */
  async notificarConclusaoTarefa(tarefa, usuarioQueFinalizou) {
    try {
      console.log("📧 Iniciando notificação de conclusão da tarefa...");
      
      // Buscar dados do responsável da tarefa
      const [[responsavel]] = await db.query(
        `SELECT nome, email, telefone FROM usuarios WHERE id = ?`,
        [tarefa.responsavelId]
      );

      if (!responsavel) {
        console.log("⚠️ Responsável não encontrado para notificação");
        return;
      }

      // Buscar dados do cliente
      const [[cliente]] = await db.query(
        `SELECT razao_social AS nome, cpf_cnpj AS cnpjCpf FROM clientes WHERE id = ?`,
        [tarefa.clienteId]
      );

      // Buscar dados da empresa
      const [[empresa]] = await db.query(
        `SELECT razaoSocial, logo_url FROM empresas WHERE id = ?`,
        [tarefa.empresaId]
      );

      // Buscar dados do departamento
      const [[departamento]] = await db.query(
        `SELECT nome FROM departamentos WHERE id = ?`,
        [tarefa.departamentoId]
      );

      // Buscar dados do processo (se existir)
      let processo = null;
      if (tarefa.processoId) {
        const [[processoData]] = await db.query(
          `SELECT nome FROM processos WHERE id = ?`,
          [tarefa.processoId]
        );
        processo = processoData;
      }

      // Enviar e-mail de conclusão
      if (responsavel.email) {
        await this.enviarEmailConclusao(
          responsavel.email,
          responsavel.nome,
          tarefa,
          cliente,
          empresa,
          departamento,
          processo,
          usuarioQueFinalizou
        );
      }

      // Enviar WhatsApp de conclusão
      if (responsavel.telefone) {
        await this.enviarWhatsAppConclusao(
          responsavel.telefone,
          responsavel.nome,
          tarefa,
          cliente,
          empresa,
          usuarioQueFinalizou
        );
      }

      console.log("📧 Notificação de conclusão enviada com sucesso!");
    } catch (error) {
      console.error("❌ Erro ao enviar notificação de conclusão:", error);
      // Não falha a conclusão da tarefa se a notificação falhar
    }
  }

  /**
   * Envia e-mail de conclusão da tarefa
   */
  async enviarEmailConclusao(
    emailResponsavel,
    nomeResponsavel,
    tarefa,
    cliente,
    empresa,
    departamento,
    processo,
    usuarioQueFinalizou
  ) {
    const assunto = `CF Titan: Tarefa Concluída - ${tarefa.assunto}`;
    
    const dataFormatada = new Date(tarefa.dataConclusao).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          /* Design System CF Titan */
          * { box-sizing: border-box; margin: 0; padding: 0; }
          
          body {
            font-family: 'Inter', 'Poppins', -apple-system, BlinkMacSystemFont, sans-serif;
            line-height: 1.4;
            color: #E6E9F0;
            background: linear-gradient(135deg, #0B0B11 0%, #000024 50%, #000080 100%);
            margin: 0;
            padding: 0;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
          }
          
          .email-container {
            max-width: 600px;
            margin: 0 auto;
            background: rgba(255, 255, 255, 0.04);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
          }
          
          .header {
            background: linear-gradient(135deg, #2EE5B6 0%, #1DB584 100%);
            color: #0B0B11;
            padding: 32px 24px;
            text-align: center;
            border-radius: 16px 16px 0 0;
          }
          
          .header h1 {
            font-size: 24px;
            font-weight: 600;
            margin: 0;
            text-shadow: none;
          }
          
          .header p {
            font-size: 14px;
            margin: 8px 0 0 0;
            opacity: 0.8;
            font-weight: 500;
          }
          
          .content {
            padding: 32px 24px;
            background: rgba(255, 255, 255, 0.04);
          }
          
          .greeting {
            font-size: 16px;
            color: #E6E9F0;
            margin-bottom: 24px;
            font-weight: 400;
          }
          
          .info-card {
            background: rgba(255, 255, 255, 0.08);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 12px;
            padding: 20px;
            margin: 16px 0;
            border-left: 4px solid #2EE5B6;
          }
          
          .info-card h3 {
            color: #2EE5B6;
            font-size: 14px;
            font-weight: 600;
            margin-bottom: 12px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          
          .info-row {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin: 8px 0;
            flex-wrap: wrap;
          }
          
          .info-label {
            color: #B5B9C6;
            font-size: 14px;
            font-weight: 500;
            min-width: 120px;
          }
          
          .info-value {
            color: #E6E9F0;
            font-size: 14px;
            font-weight: 400;
            flex: 1;
            text-align: right;
            word-break: break-word;
          }
          
          .description-text {
            color: #B5B9C6;
            font-size: 14px;
            line-height: 1.6;
            margin-top: 8px;
            padding: 12px;
            background: rgba(255, 255, 255, 0.04);
            border-radius: 8px;
            font-style: italic;
          }
          
          .cta-section {
            text-align: center;
            margin: 32px 0 24px 0;
          }
          
          .cta-button {
            display: inline-block;
            background: linear-gradient(135deg, #000080 0%, #004CFF 100%);
            color: #E6E9F0;
            padding: 14px 28px;
            text-decoration: none;
            border-radius: 12px;
            font-size: 14px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.4);
            transition: all 160ms ease-out;
          }
          
          .cta-button:hover {
            background: linear-gradient(135deg, #004CFF 0%, #7B4DFF 100%);
            box-shadow: 0 0 8px rgba(0, 76, 255, 0.33);
            transform: translateY(-1px);
          }
          
          .success-message {
            background: rgba(46, 229, 182, 0.1);
            border: 1px solid rgba(46, 229, 182, 0.2);
            border-radius: 12px;
            padding: 16px;
            margin: 20px 0;
            color: #2EE5B6;
            font-size: 14px;
            font-weight: 500;
            text-align: center;
          }
          
          .footer {
            background: rgba(0, 0, 0, 0.2);
            padding: 24px;
            text-align: center;
            border-top: 1px solid rgba(255, 255, 255, 0.08);
          }
          
          .footer p {
            color: #6F7384;
            font-size: 12px;
            line-height: 1.5;
            margin: 0;
          }
          
          .footer strong {
            color: #B5B9C6;
            font-weight: 600;
          }
          
          @media (max-width: 640px) {
            .email-container { margin: 16px; border-radius: 12px; }
            .header { padding: 24px 16px; }
            .content { padding: 24px 16px; }
            .info-row { flex-direction: column; align-items: flex-start; }
            .info-label { margin-bottom: 4px; }
            .info-value { text-align: left; }
          }
        </style>
      </head>
      <body>
        <div class="email-container">
          <div class="header">
            <h1>Tarefa Concluída</h1>
            <p>Sistema CF Titan - Gestão de Tarefas</p>
          </div>
          
          <div class="content">
            <div class="greeting">
              Olá <strong>${nomeResponsavel}</strong>,
            </div>
            
            <div class="success-message">
              A tarefa sob sua responsabilidade foi concluída com sucesso
            </div>
            
            <div class="info-card">
              <h3>Detalhes da Tarefa</h3>
              <div class="info-row">
                <span class="info-label">ID da Tarefa:</span>
                <span class="info-value">#${tarefa.id}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Assunto:</span>
                <span class="info-value">${tarefa.assunto}</span>
              </div>
              ${tarefa.descricao ? `
                <div class="description-text">
                  ${tarefa.descricao}
                </div>
              ` : ''}
              <div class="info-row">
                <span class="info-label">Concluída em:</span>
                <span class="info-value">${dataFormatada}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Finalizada por:</span>
                <span class="info-value">${usuarioQueFinalizou.nome}</span>
              </div>
            </div>
            
            <div class="info-card">
              <h3>Informações do Cliente</h3>
              <div class="info-row">
                <span class="info-label">Cliente:</span>
                <span class="info-value">${cliente?.nome || 'Não informado'}</span>
              </div>
              ${cliente?.cnpjCpf ? `
                <div class="info-row">
                  <span class="info-label">CPF/CNPJ:</span>
                  <span class="info-value">${cliente.cnpjCpf}</span>
                </div>
              ` : ''}
              <div class="info-row">
                <span class="info-label">Empresa:</span>
                <span class="info-value">${empresa?.razaoSocial || 'Não informado'}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Departamento:</span>
                <span class="info-value">${departamento?.nome || 'Não informado'}</span>
              </div>
              ${processo ? `
                <div class="info-row">
                  <span class="info-label">Processo:</span>
                  <span class="info-value">${processo.nome}</span>
                </div>
              ` : ''}
            </div>
            
            <div class="cta-section">
              <a href="https://app.cftitan.com.br/gestao/${tarefa.id}/atividades" class="cta-button">
                Visualizar Tarefa
              </a>
            </div>
          </div>
          
          <div class="footer">
            <p><strong>Sistema CF Titan</strong><br>
               Este é um e-mail automático gerado pelo sistema</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const mailOptions = {
      from: process.env.EMAIL_FROM || 'sistema@cftitan.com.br',
      to: emailResponsavel,
      subject: assunto,
      html: html
    };

    await this.transporter.sendMail(mailOptions);
    console.log(`📧 E-mail de conclusão enviado para: ${emailResponsavel}`);
  }

  /**
   * Envia WhatsApp de conclusão da tarefa
   */
  async enviarWhatsAppConclusao(
    telefoneResponsavel,
    nomeResponsavel,
    tarefa,
    cliente,
    empresa,
    usuarioQueFinalizou
  ) {
    const dataFormatada = new Date(tarefa.dataConclusao).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const mensagem = `*CF TITAN - TAREFA CONCLUÍDA*

Olá *${nomeResponsavel}*,

A tarefa sob sua responsabilidade foi *concluída com sucesso*.

*DETALHES DA TAREFA:*
• ID: #${tarefa.id}
• Assunto: ${tarefa.assunto}
• Concluída em: ${dataFormatada}
• Finalizada por: ${usuarioQueFinalizou.nome}

*INFORMAÇÕES DO CLIENTE:*
• Cliente: ${cliente?.nome || 'Não informado'}
• Empresa: ${empresa?.razaoSocial || 'Não informado'}

Para visualizar todos os detalhes:
https://app.cftitan.com.br/gestao/${tarefa.id}/atividades

*Sistema CF Titan - Gestão de Tarefas*`;

    // Formatar telefone para internacional (remover caracteres não numéricos)
    const numero = telefoneResponsavel.replace(/\D/g, "");
    
    try {
      // Enviar via Z-API
      const response = await fetch("https://api.z-api.io/instances/3E49EC6B1CCDE0D5F124026A127A4111/token/A1A276E2FA5A377E1673631F/send-text", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Client-Token": "Fa1b5d1944e5248848a63467268e3fdccS"
        },
        body: JSON.stringify({
          phone: numero,
          message: mensagem
        })
      });

      if (response.ok) {
        console.log(`📱 WhatsApp de conclusão enviado para: ${numero}`);
      } else {
        console.error("❌ Erro ao enviar WhatsApp de conclusão:", await response.text());
      }
    } catch (error) {
      console.error("❌ Erro ao enviar WhatsApp de conclusão:", error);
    }
  }

  /**
   * Envia e-mail para um responsável específico
   */
  async enviarEmailSubtarefa(
    emailResponsavel,
    nomeResponsavel,
    tarefaPai,
    subtarefas,
    cliente,
    empresa,
    departamento,
    usuarioCriador,
    replyToEmail
  ) {
    const assunto = `Nova tarefa atribuída: ${tarefaPai.assunto}`;
    
    const corpo = this.gerarCorpoEmailSubtarefa(
      nomeResponsavel,
      tarefaPai,
      subtarefas,
      cliente,
      empresa,
      departamento,
      usuarioCriador,
      replyToEmail
    );

    const mailOptions = {
      from: `"${empresa.razaoSocial}" <${process.env.EMAIL_USER}>`,
      to: emailResponsavel,
      subject: assunto,
      html: corpo,
      replyTo: replyToEmail || process.env.EMAIL_USER,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log(`✅ E-mail enviado para ${emailResponsavel}`);
      
      // Registrar no banco de dados (comentado por padrão)
      // await this.registrarEmailEnviado(tarefaPai.id, emailResponsavel, assunto, corpo);
    } catch (error) {
      console.error(`❌ Erro ao enviar e-mail para ${emailResponsavel}:`, error);
      throw error;
    }
  }

  /**
   * Envia e-mail de boas-vindas para novo usuário
   */
  async enviarEmailBoasVindas(email, nome) {
    const assunto = "Bem-vindo(a) ao Titan!";
    const logoTitan = "https://res.cloudinary.com/di22pd88m/image/upload/v1755725360/titan-branco_1_crrr6v.svg";
    const linkAcesso = "https://app.cftitan.com.br";
    const contatoBeatriz = "Beatriz - (21) 97966-1125";
    const linkBugs = "https://contabhubbycf.atlassian.net/jira/software/form/1f322f35-daa0-4113-b726-419b056ff1e1";
    const corpo = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Bem-vindo ao TITAN</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body {
            font-family: 'Inter', 'Poppins', -apple-system, BlinkMacSystemFont, sans-serif;
            background: #0B0B11;
            color: #E6E9F0;
            line-height: 1.4;
            padding: 32px 16px;
          }
          
          .container {
            max-width: 600px;
            margin: 0 auto;
            background: #000024;
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
          }
          
          .header {
            background: linear-gradient(135deg, #000080 0%, #004CFF 50%, #7B4DFF 100%);
            padding: 48px 32px;
            text-align: center;
            position: relative;
          }
          
          .header::after {
            content: '';
            position: absolute;
            bottom: 0;
            left: 0;
            right: 0;
            height: 1px;
            background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
          }
          
          .logo {
            max-width: 120px;
            margin-bottom: 24px;
            border-radius: 8px;
          }
          
          .header h1 {
            color: #E6E9F0;
            font-size: 1.875rem;
            font-weight: 700;
            margin-bottom: 8px;
            text-shadow: 0 0 20px rgba(255, 255, 255, 0.3);
          }
          
          .header p {
            color: #B5B9C6;
            font-size: 1rem;
            margin: 0;
            opacity: 0.9;
            font-weight: 500;
          }
          
          .content {
            padding: 48px 32px;
            background: #000024;
          }
          
          .greeting {
            font-size: 1.5rem;
            color: #E6E9F0;
            margin-bottom: 32px;
            font-weight: 600;
            text-align: center;
          }
          
          .welcome-message {
            font-size: 1.125rem;
            color: #B5B9C6;
            margin-bottom: 32px;
            line-height: 1.6;
            text-align: center;
          }
          
          .password-section {
            background: rgba(255, 202, 58, 0.1);
            border: 1px solid rgba(255, 202, 58, 0.3);
            border-radius: 12px;
            padding: 24px;
            margin: 32px 0;
            text-align: center;
            backdrop-filter: blur(20px);
          }
          
          .password-section h3 {
            color: #FFCA3A;
            font-size: 1.125rem;
            font-weight: 600;
            margin-bottom: 16px;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
          }
          
          .password-section h3::before {
            content: '🔐';
            font-size: 1.25rem;
          }
          
          .password-display {
            background: rgba(255, 255, 255, 0.04);
            border: 1px solid rgba(255, 202, 58, 0.2);
            border-radius: 8px;
            padding: 16px;
            font-family: 'Courier New', monospace;
            font-size: 1.25rem;
            font-weight: bold;
            color: #FFCA3A;
            letter-spacing: 2px;
            margin-bottom: 12px;
          }
          
          .features-section {
            background: rgba(255, 255, 255, 0.04);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 12px;
            padding: 32px;
            margin: 32px 0;
            backdrop-filter: blur(20px);
          }
          
          .features-section h3 {
            color: #E6E9F0;
            font-size: 1.25rem;
            font-weight: 600;
            margin-bottom: 20px;
            text-align: center;
          }
          
          .features-list {
            list-style: none;
            padding: 0;
          }
          
          .features-list li {
            color: #B5B9C6;
            font-size: 1rem;
            margin-bottom: 16px;
            padding-left: 24px;
            position: relative;
            line-height: 1.5;
          }
          
          .features-list li::before {
            content: '✨';
            position: absolute;
            left: 0;
            top: 0;
          }
          
          .features-list li strong {
            color: #E6E9F0;
            font-weight: 600;
          }
          
          .cta-section {
            text-align: center;
            margin: 40px 0;
          }
          
          .cta-button {
            display: inline-block;
            background: linear-gradient(135deg, #000080 0%, #004CFF 50%, #7B4DFF 100%);
            color: #FFFFFF !important;
            text-decoration: none;
            padding: 20px 40px;
            border-radius: 12px;
            font-size: 1.125rem;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            box-shadow: 0 8px 25px rgba(0, 0, 0, 0.4);
            border: 2px solid transparent;
            font-family: 'Inter', 'Poppins', -apple-system, BlinkMacSystemFont, sans-serif;
            text-shadow: 0 0 10px rgba(255, 255, 255, 0.5);
            transition: all 160ms ease-out;
          }
          
          .cta-button:hover {
            transform: translateY(-2px);
            box-shadow: 0 12px 35px rgba(0, 0, 0, 0.6);
            color: #FFFFFF !important;
            text-shadow: 0 0 15px rgba(255, 255, 255, 0.8);
          }
          
          .support-section {
            background: rgba(0, 76, 255, 0.1);
            border: 1px solid rgba(0, 76, 255, 0.3);
            border-radius: 12px;
            padding: 24px;
            margin: 32px 0;
            text-align: center;
            backdrop-filter: blur(20px);
          }
          
          .support-section h3 {
            color: #004CFF;
            font-size: 1.125rem;
            font-weight: 600;
            margin-bottom: 12px;
          }
          
          .support-section p {
            color: #B5B9C6;
            font-size: 1rem;
            margin-bottom: 16px;
            line-height: 1.5;
          }
          
          .support-section a {
            color: #004CFF;
            text-decoration: underline;
            font-weight: 600;
          }
          
          .footer {
            background: rgba(0, 0, 0, 0.4);
            padding: 32px;
            text-align: center;
            border-top: 1px solid rgba(255, 255, 255, 0.05);
          }
          
          .footer p {
            color: #6F7384;
            font-size: 0.875rem;
            margin-bottom: 8px;
            line-height: 1.4;
          }
          
          .footer .highlight {
            color: #004CFF;
            font-weight: 600;
            font-size: 1rem;
            margin-top: 16px;
          }
          
          @media (max-width: 600px) {
            .container {
              margin: 16px;
              border-radius: 12px;
            }
            
            .header, .content, .footer {
              padding-left: 24px;
              padding-right: 24px;
            }
            
            .features-section {
              padding: 24px;
            }
            
            .cta-button {
              padding: 16px 32px;
              font-size: 1rem;
            }
            
            .greeting {
              font-size: 1.25rem;
            }
            
            .welcome-message {
              font-size: 1rem;
            }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <img src="${logoTitan}" alt="TITAN" class="logo">
            <h1>Bem-vindo ao TITAN!</h1>
            <p>Sistema de Gestão Contábil Inteligente</p>
          </div>
          
          <div class="content">
            <div class="greeting">Olá, ${nome}!</div>
            
            <div class="welcome-message">
              É um enorme prazer ter você conosco na plataforma TITAN.<br>
            Nosso time está muito feliz em poder contribuir com a sua rotina e tornar sua gestão contábil mais leve, segura e produtiva.
            </div>
            
            <div class="password-section">
              <h3>Sua Senha Inicial de Acesso</h3>
              <div class="password-display">admin123</div>
              <p style="color: #B5B9C6; font-size: 0.875rem; font-style: italic;">
                Recomendamos alterá-la após o primeiro acesso para garantir sua segurança
              </p>
            </div>
            
            <div class="features-section">
              <h3>O que você pode fazer no TITAN?</h3>
              <ul class="features-list">
                <li><strong>Controle de Certificados Digitais:</strong> Receba alertas de vencimento e nunca mais perca um prazo importante.</li>
                <li><strong>Situação Fiscal (SitFis):</strong> Consulte e monitore a situação fiscal dos seus clientes de forma centralizada e rápida.</li>
                <li><strong>Parcelamentos:</strong> Visualize todos os parcelamentos em aberto, vencidos ou quitados de cada cliente.</li>
                <li><strong>Tarefas e Obrigações:</strong> Crie, delegue e acompanhe tarefas, obrigações e subprocessos, garantindo que nada fique para trás.</li>
                <li><strong>Notificações Inteligentes:</strong> Receba alertas por e-mail e WhatsApp sobre prazos, pendências e novidades do sistema.</li>
                <li><strong>Relatórios e Painéis:</strong> Visualize o desempenho do seu time, produtividade e status das entregas em tempo real.</li>
            </ul>
          </div>
            
            <div class="cta-section">
              <a href="${linkAcesso}" class="cta-button">
                Acessar o TITAN
              </a>
          </div>
            
            <div class="support-section">
              <h3>Suporte e Feedback</h3>
              <p>
                Sempre que precisar, pode falar diretamente com <strong>${contatoBeatriz}</strong>.<br>
                Se encontrar algum bug ou quiser sugerir melhorias, acesse nosso <a href="${linkBugs}">formulário de feedback</a>.<br>
            Estamos aqui para te apoiar em cada etapa!
          </p>
        </div>
      </div>
            
          <div class="footer">
            <p>Este e-mail foi enviado automaticamente pelo sistema TITAN</p>
            <p>Seja muito bem-vindo(a) e aproveite ao máximo todos os recursos!</p>
            <p class="highlight">TITAN - Simplificando sua rotina contábil</p>
          </div>
        </div>
      </body>
      </html>
    `;
    const mailOptions = {
      from: `Sistema Titan <${process.env.EMAIL_USER}>`,
      to: email,
      subject: assunto,
      html: corpo,
    };
    try {
      await this.transporter.sendMail(mailOptions);
      console.log(`✅ E-mail de boas-vindas enviado para ${email}`);
    } catch (error) {
      console.error(`❌ Erro ao enviar e-mail de boas-vindas para ${email}:`, error);
    }
  }

  /**
   * Envia e-mail de recuperação de senha
   */
  async enviarEmailRecuperacaoSenha(email, nome, resetToken) {
    const assunto = "Redefinir Senha - TITAN";
    // Logo SVG branco do Cloudinary
    const logoTitan = "https://res.cloudinary.com/di22pd88m/image/upload/v1755725360/titan-branco_1_crrr6v.svg";
    const linkRedefinir = `${process.env.FRONTEND_URL || 'https://app.cftitan.com.br'}/auth/reset-password?token=${resetToken}`;
    
    const corpo = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Redefinir Senha - TITAN</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body {
            font-family: 'Inter', 'Poppins', -apple-system, BlinkMacSystemFont, sans-serif;
            background: #0B0B11;
            color: #E6E9F0;
            line-height: 1.4;
            padding: 32px 16px;
          }
          
          .container {
            max-width: 600px;
            margin: 0 auto;
            background: #000024;
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
          }
          
          .header {
            background: linear-gradient(135deg, #000080 0%, #004CFF 50%, #7B4DFF 100%);
            padding: 48px 32px;
            text-align: center;
            position: relative;
          }
          
          .header::after {
            content: '';
            position: absolute;
            bottom: 0;
            left: 0;
            right: 0;
            height: 1px;
            background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
          }
          
          .logo {
            max-width: 120px;
            margin-bottom: 24px;
            border-radius: 8px;
          }
          
          .header h1 {
            color: #E6E9F0;
            font-size: 1.875rem;
            font-weight: 700;
            margin-bottom: 8px;
            text-shadow: 0 0 20px rgba(255, 255, 255, 0.3);
          }
          
          .header p {
            color: #B5B9C6;
            font-size: 1rem;
            margin: 0;
            opacity: 0.9;
            font-weight: 500;
          }
          
          .content {
            padding: 48px 32px;
            background: #000024;
          }
          
          .greeting {
            font-size: 1.5rem;
            color: #E6E9F0;
            margin-bottom: 32px;
            font-weight: 600;
            text-align: center;
          }
          
          .message {
            font-size: 1.125rem;
            color: #B5B9C6;
            margin-bottom: 40px;
            line-height: 1.6;
            text-align: center;
          }
          
          .cta-section {
            text-align: center;
            margin: 40px 0;
          }
          
          .cta-button {
            display: inline-block;
            background: linear-gradient(135deg, #000080 0%, #004CFF 50%, #7B4DFF 100%);
            color: #FFFFFF !important;
            text-decoration: none;
            padding: 20px 40px;
            border-radius: 12px;
            font-size: 1.125rem;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            box-shadow: 0 8px 25px rgba(0, 0, 0, 0.4);
            border: 2px solid transparent;
            font-family: 'Inter', 'Poppins', -apple-system, BlinkMacSystemFont, sans-serif;
            text-shadow: 0 0 10px rgba(255, 255, 255, 0.5);
            transition: all 160ms ease-out;
          }
          
          .cta-button:hover {
            transform: translateY(-2px);
            box-shadow: 0 12px 35px rgba(0, 0, 0, 0.6);
            color: #FFFFFF !important;
            text-shadow: 0 0 15px rgba(255, 255, 255, 0.8);
          }
          
          .divider {
            height: 1px;
            background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.1), transparent);
            margin: 32px 0;
          }
          
          .link-alternativo {
            margin-top: 32px;
            text-align: center;
          }
          
          .link-alternativo h3 {
            color: #E6E9F0;
            font-size: 1.125rem;
            font-weight: 600;
            margin-bottom: 16px;
          }
          
          .link-copiavel {
            background: rgba(255, 255, 255, 0.04);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 12px;
            padding: 20px;
            text-align: center;
            max-width: 520px;
            margin: 0 auto;
            backdrop-filter: blur(20px);
          }
          
          .link-texto {
            color: #004CFF;
            font-family: 'Courier New', monospace;
            font-size: 0.875rem;
            word-break: break-all;
            display: block;
            background: rgba(0, 76, 255, 0.1);
            padding: 12px;
            border-radius: 8px;
            border: 1px solid rgba(0, 76, 255, 0.2);
            margin-bottom: 12px;
          }
          
          .copy-instruction {
            color: #B5B9C6;
            font-size: 0.875rem;
            font-style: italic;
          }
          
          .security-note {
            background: rgba(0, 76, 255, 0.1);
            border: 1px solid rgba(0, 76, 255, 0.3);
            border-radius: 12px;
            padding: 24px;
            margin: 32px 0;
            text-align: center;
            backdrop-filter: blur(20px);
          }
          
          .security-note h3 {
            color: #004CFF;
            font-size: 1.125rem;
            font-weight: 600;
            margin-bottom: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
          }
          
          .security-note h3::before {
            content: '🔒';
            font-size: 1.25rem;
          }
          
          .security-note p {
            color: #B5B9C6;
            font-size: 1rem;
            margin: 0;
            line-height: 1.5;
          }
          
          .footer {
            background: rgba(0, 0, 0, 0.4);
            padding: 32px;
            text-align: center;
            border-top: 1px solid rgba(255, 255, 255, 0.05);
          }
          
          .footer p {
            color: #6F7384;
            font-size: 0.875rem;
            margin-bottom: 8px;
            line-height: 1.4;
          }
          
          .footer .highlight {
            color: #004CFF;
            font-weight: 600;
            font-size: 1rem;
            margin-top: 16px;
          }
          
          @media (max-width: 600px) {
            .container {
              margin: 16px;
            border-radius: 12px;
            }
            
            .header, .content, .footer {
              padding-left: 24px;
              padding-right: 24px;
            }
            
            .cta-button {
              padding: 16px 32px;
              font-size: 1rem;
            }
            
            .greeting {
              font-size: 1.25rem;
            }
            
            .message {
            font-size: 1rem;
          }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <img src="${logoTitan}" alt="TITAN" class="logo">
            <h1>Redefinir Senha</h1>
            <p>Sistema de Gestão Contábil Inteligente</p>
          </div>
          
          <div class="content">
            <div class="greeting">Olá, ${nome}!</div>
            
            <div class="message">
              Recebemos uma solicitação para redefinir a senha da sua conta no sistema TITAN.<br>
              Se você não fez essa solicitação, pode ignorar este e-mail com segurança.
            </div>
            
            <div class="cta-section">
              <a href="${linkRedefinir}" class="cta-button">
                Redefinir Minha Senha
              </a>
            </div>
            
            <div class="divider"></div>
              
              <div class="link-alternativo">
              <h3>Link Alternativo</h3>
                <div class="link-copiavel">
                <div class="link-texto">${linkRedefinir}</div>
                <p class="copy-instruction">Copie e cole este link no seu navegador caso o botão não funcione</p>
              </div>
            </div>
            
            <div class="security-note">
              <h3>Segurança em Primeiro Lugar</h3>
              <p>
                Este link expira em <strong>1 hora</strong> por motivos de segurança.<br>
                Nunca compartilhe este e-mail com outras pessoas.
              </p>
            </div>
          </div>
            
            <div class="footer">
            <p>Este e-mail foi enviado automaticamente pelo sistema TITAN</p>
              <p>Em caso de dúvidas, entre em contato com nosso suporte</p>
              <p class="highlight">TITAN - Simplificando sua rotina contábil</p>
        </div>
      </div>
      </body>
      </html>
    `;
    
    const mailOptions = {
      from: `TITAN <${process.env.EMAIL_USER}>`,
      to: email,
      subject: assunto,
      html: corpo,
    };
    
    try {
      await this.transporter.sendMail(mailOptions);
      console.log(`✅ E-mail de recuperação de senha enviado para ${email}`);
    } catch (error) {
      console.error(`❌ Erro ao enviar e-mail de recuperação de senha para ${email}:`, error);
    }
  }

  /**
   * Envia e-mail com nova senha gerada pelo administrador
   */
  async enviarEmailNovaSenha(email, nome, novaSenha) {
    const assunto = "Nova senha gerada - Titan";
    const logoTitan = "https://res.cloudinary.com/di22pd88m/image/upload/v1755725360/titan-branco_1_crrr6v.svg";
    const corpo = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Nova Senha Gerada - TITAN</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body {
            font-family: 'Inter', 'Poppins', -apple-system, BlinkMacSystemFont, sans-serif;
            background: #0B0B11;
            color: #E6E9F0;
            line-height: 1.4;
            padding: 32px 16px;
          }
          
          .container {
            max-width: 600px;
            margin: 0 auto;
            background: #000024;
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
          }
          
          .header {
            background: linear-gradient(135deg, #000080 0%, #004CFF 50%, #7B4DFF 100%);
            padding: 48px 32px;
            text-align: center;
            position: relative;
          }
          
          .header::after {
            content: '';
            position: absolute;
            bottom: 0;
            left: 0;
            right: 0;
            height: 1px;
            background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
          }
          
          .logo {
            max-width: 120px;
            margin-bottom: 24px;
            border-radius: 8px;
          }
          
          .header h1 {
            color: #E6E9F0;
            font-size: 1.875rem;
            font-weight: 700;
            margin-bottom: 8px;
            text-shadow: 0 0 20px rgba(255, 255, 255, 0.3);
          }
          
          .header p {
            color: #B5B9C6;
            font-size: 1rem;
            margin: 0;
            opacity: 0.9;
            font-weight: 500;
          }
          
          .content {
            padding: 48px 32px;
            background: #000024;
          }
          
          .greeting {
            font-size: 1.5rem;
            color: #E6E9F0;
            margin-bottom: 32px;
            font-weight: 600;
            text-align: center;
          }
          
          .message {
            font-size: 1.125rem;
            color: #B5B9C6;
            margin-bottom: 40px;
            line-height: 1.6;
            text-align: center;
          }
          
          .password-section {
            background: rgba(46, 229, 182, 0.1);
            border: 1px solid rgba(46, 229, 182, 0.3);
            border-radius: 12px;
            padding: 24px;
            margin: 32px 0;
            text-align: center;
            backdrop-filter: blur(20px);
          }
          
          .password-section h3 {
            color: #2EE5B6;
            font-size: 1.125rem;
            font-weight: 600;
            margin-bottom: 16px;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
          }
          
          .password-section h3::before {
            content: '🔑';
            font-size: 1.25rem;
          }
          
          .password-display {
            background: rgba(255, 255, 255, 0.04);
            border: 1px solid rgba(46, 229, 182, 0.2);
            border-radius: 8px;
            padding: 16px;
            font-family: 'Courier New', monospace;
            font-size: 1.25rem;
            font-weight: bold;
            color: #2EE5B6;
            letter-spacing: 2px;
            margin-bottom: 12px;
            word-break: break-all;
          }
          
          .security-warning {
            background: rgba(255, 202, 58, 0.1);
            border: 1px solid rgba(255, 202, 58, 0.3);
            border-radius: 12px;
            padding: 20px;
            margin: 32px 0;
            text-align: center;
            backdrop-filter: blur(20px);
          }
          
          .security-warning h3 {
            color: #FFCA3A;
            font-size: 1.125rem;
            font-weight: 600;
            margin-bottom: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
          }
          
          .security-warning h3::before {
            content: '⚠️';
            font-size: 1.25rem;
          }
          
          .security-warning p {
            color: #B5B9C6;
            font-size: 1rem;
            margin: 0;
            line-height: 1.5;
          }
          
          .cta-section {
            text-align: center;
            margin: 40px 0;
          }
          
          .cta-button {
            display: inline-block;
            background: linear-gradient(135deg, #000080 0%, #004CFF 50%, #7B4DFF 100%);
            color: #FFFFFF !important;
            text-decoration: none;
            padding: 20px 40px;
            border-radius: 12px;
            font-size: 1.125rem;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            box-shadow: 0 8px 25px rgba(0, 0, 0, 0.4);
            border: 2px solid transparent;
            font-family: 'Inter', 'Poppins', -apple-system, BlinkMacSystemFont, sans-serif;
            text-shadow: 0 0 10px rgba(255, 255, 255, 0.5);
            transition: all 160ms ease-out;
          }
          
          .cta-button:hover {
            transform: translateY(-2px);
            box-shadow: 0 12px 35px rgba(0, 0, 0, 0.6);
            color: #FFFFFF !important;
            text-shadow: 0 0 15px rgba(255, 255, 255, 0.8);
          }
          
          .footer {
            background: rgba(0, 0, 0, 0.4);
            padding: 32px;
            text-align: center;
            border-top: 1px solid rgba(255, 255, 255, 0.05);
          }
          
          .footer p {
            color: #6F7384;
            font-size: 0.875rem;
            margin-bottom: 8px;
            line-height: 1.4;
          }
          
          .footer .highlight {
            color: #004CFF;
            font-weight: 600;
            font-size: 1rem;
            margin-top: 16px;
          }
          
          @media (max-width: 600px) {
            .container {
              margin: 16px;
              border-radius: 12px;
            }
            
            .header, .content, .footer {
              padding-left: 24px;
              padding-right: 24px;
            }
            
            .cta-button {
              padding: 16px 32px;
              font-size: 1rem;
            }
            
            .greeting {
              font-size: 1.25rem;
            }
            
            .message {
              font-size: 1rem;
            }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <img src="${logoTitan}" alt="TITAN" class="logo">
            <h1>Nova Senha Gerada</h1>
            <p>Sistema de Gestão Contábil Inteligente</p>
          </div>
          
          <div class="content">
            <div class="greeting">Olá, ${nome}!</div>
            
            <div class="message">
              Uma nova senha foi gerada para sua conta no sistema TITAN pelo administrador.<br>
              Use a senha abaixo para fazer login no sistema.
            </div>
            
            <div class="password-section">
              <h3>Sua Nova Senha</h3>
              <div class="password-display">${novaSenha}</div>
              <p style="color: #B5B9C6; font-size: 0.875rem; font-style: italic;">
                Copie esta senha exatamente como mostrada acima
              </p>
          </div>
            
            <div class="security-warning">
              <h3>Recomendação de Segurança</h3>
              <p>
                Por segurança, recomendamos que você <strong>altere esta senha</strong><br>
                após fazer o primeiro login no sistema.
          </p>
        </div>
            
            <div class="cta-section">
              <a href="${process.env.FRONTEND_URL || 'https://app.cftitan.com.br'}/auth/login" class="cta-button">
                Acessar o Sistema
              </a>
      </div>
          </div>
            
          <div class="footer">
            <p>Este e-mail foi enviado automaticamente pelo sistema TITAN</p>
            <p>Se você não solicitou esta alteração, entre em contato com o administrador</p>
            <p class="highlight">TITAN - Simplificando sua rotina contábil</p>
          </div>
        </div>
      </body>
      </html>
    `;
    const mailOptions = {
      from: `Sistema Titan <${process.env.EMAIL_USER}>`,
      to: email,
      subject: assunto,
      html: corpo,
    };
    try {
      await this.transporter.sendMail(mailOptions);
      console.log(`✅ E-mail com nova senha enviado para ${email}`);
    } catch (error) {
      console.error(`❌ Erro ao enviar e-mail com nova senha para ${email}:`, error);
    }
  }

  /**
   * Gera o corpo do e-mail para notificação de subtarefa
   */
  gerarCorpoEmailSubtarefa(
    nomeResponsavel,
    tarefaPai,
    subtarefas,
    cliente,
    empresa,
    departamento,
    usuarioCriador,
    replyToEmail
  ) {
    const formatarData = (data) => {
      if (!data) return "Não definida";
      return new Date(data).toLocaleDateString('pt-BR');
    };

    const subtarefasHtml = subtarefas.map(sub => `
      <tr style="border-bottom: 1px solid #e5e7eb;">
        <td style="padding: 12px 8px; vertical-align: top;">
          <strong>${sub.assunto}</strong>
        </td>
        <td style="padding: 12px 8px; vertical-align: top;">
          ${formatarData(sub.dataAcao)}
        </td>
        <td style="padding: 12px 8px; vertical-align: top;">
          ${formatarData(sub.dataMeta)}
        </td>
        <td style="padding: 12px 8px; vertical-align: top;">
          ${formatarData(sub.dataPrazo)}
        </td>
      </tr>
    `).join('');

    return `
      <div style="font-family: Arial, sans-serif; background: #f8fafc; padding: 32px 0;">
        <div style="max-width: 600px; margin: 0 auto; background: #fff; border-radius: 12px; box-shadow: 0 2px 12px #e0e7ef; padding: 32px 28px;">
          <div style="text-align: center; margin-bottom: 24px;">
            <img src="${empresa.logo_url || 'https://app.cftitan.com.br/logo.png'}" alt="Logo da empresa" style="max-width: 180px; margin-bottom: 18px; border-radius: 10px;" />
            <h2 style="color: #2563eb; margin-bottom: 8px;">Nova Tarefa Atribuída</h2>
          </div>
          
          <p style="font-size: 1.08rem; color: #334155; margin-bottom: 20px;">
            Olá <strong>${nomeResponsavel}</strong>!
          </p>
          
          <p style="font-size: 1.08rem; color: #334155; margin-bottom: 24px;">
            Uma nova tarefa foi criada e você foi designado como responsável por algumas subtarefas relacionadas.
          </p>
          
          <div style="background: #f1f5f9; padding: 20px; border-radius: 8px; margin-bottom: 24px;">
            <h3 style="color: #1e293b; margin-bottom: 16px;">Detalhes da Tarefa Principal</h3>
            <p><strong>Assunto:</strong> ${tarefaPai.assunto}</p>
            <p><strong>Cliente:</strong> ${cliente.nome} (${cliente.cnpjCpf})</p>
            <p><strong>Departamento:</strong> ${departamento.nome}</p>
            <p><strong>Criado por:</strong> ${usuarioCriador.nome}</p>
            <p><strong>Data de Ação:</strong> ${formatarData(tarefaPai.dataAcao)}</p>
            <p><strong>Data Meta:</strong> ${formatarData(tarefaPai.dataMeta)}</p>
            <p><strong>Data Prazo:</strong> ${formatarData(tarefaPai.dataPrazo)}</p>
          </div>
          
          <div style="margin-bottom: 24px;">
            <h3 style="color: #1e293b; margin-bottom: 16px;">Suas Subtarefas</h3>
            <table style="width: 100%; border-collapse: collapse; border: 1px solid #e5e7eb;">
              <thead>
                <tr style="background: #f8fafc;">
                  <th style="padding: 12px 8px; text-align: left; border-bottom: 1px solid #e5e7eb;">Subtarefa</th>
                  <th style="padding: 12px 8px; text-align: left; border-bottom: 1px solid #e5e7eb;">Data Ação</th>
                  <th style="padding: 12px 8px; text-align: left; border-bottom: 1px solid #e5e7eb;">Data Meta</th>
                  <th style="padding: 12px 8px; text-align: left; border-bottom: 1px solid #e5e7eb;">Data Prazo</th>
                </tr>
              </thead>
              <tbody>
                ${subtarefasHtml}
              </tbody>
            </table>
          </div>
          
          <div style="margin-top: 32px;">
            <h3 style="color: #1e293b; margin-bottom: 16px;">Acessar Suas Tarefas</h3>
            ${subtarefas.map(sub => `
              <div style="margin-bottom: 12px;">
              <a href="${process.env.FRONTEND_URL || 'https://app.cftitan.com.br'}/gestao/${sub.id}/atividades" 
                   style="background: #2563eb; color: white; padding: 8px 16px; text-decoration: none; border-radius: 6px; display: inline-block; font-size: 14px;">
                  Acessar: ${sub.assunto}
                </a>
              </div>
            `).join('')}
          </div>
          
          <p style="font-size: 0.98rem; color: #64748b; text-align: center; margin-top: 24px;">
            Este e-mail foi enviado automaticamente pelo sistema Titan.<br>
            Em caso de dúvidas, entre em contato com ${usuarioCriador.nome}${replyToEmail ? ` (${replyToEmail})` : ''}.
          </p>
        </div>
      </div>
    `;
  }

  /**
   * Envia e-mail para o responsável principal da tarefa
   */
  async enviarEmailResponsavelPrincipal(
    emailResponsavel,
    nomeResponsavel,
    tarefa,
    cliente,
    empresa,
    departamento,
    processo,
    usuarioCriador
  ) {
    const assunto = `Nova Tarefa Atribuída - ${tarefa.assunto}`;
    const corpo = this.gerarCorpoEmailResponsavelPrincipal(
      nomeResponsavel,
      tarefa,
      cliente,
      empresa,
      departamento,
      processo,
      usuarioCriador
    );

    const mailOptions = {
      from: `"${empresa?.razaoSocial || 'Sistema Titan'}" <${process.env.EMAIL_USER}>`,
      to: emailResponsavel,
      subject: assunto,
      html: corpo,
      replyTo: usuarioCriador.email || process.env.EMAIL_USER,
    };

    await this.transporter.sendMail(mailOptions);
    console.log(`📧 E-mail enviado para responsável principal: ${emailResponsavel}`);
  }

  /**
   * Gera o corpo do e-mail para o responsável principal
   */
  gerarCorpoEmailResponsavelPrincipal(
    nomeResponsavel,
    tarefa,
    cliente,
    empresa,
    departamento,
    processo,
    usuarioCriador
  ) {
    const formatarData = (data) => {
      if (!data) return '-';
      const d = new Date(data);
      return d.toLocaleDateString('pt-BR');
    };

    return `
      <div style="font-family: Arial, sans-serif; background: #f8fafc; padding: 32px 0;">
        <div style="max-width: 600px; margin: 0 auto; background: #fff; border-radius: 12px; box-shadow: 0 2px 12px #e0e7ef; padding: 32px 28px;">
          <div style="text-align: center; margin-bottom: 24px;">
            <img src="${empresa.logo_url || 'https://app.cftitan.com.br/logo.png'}" alt="Logo da empresa" style="max-width: 180px; margin-bottom: 18px; border-radius: 10px;" />
            <h2 style="color: #2563eb; margin-bottom: 8px;">Nova Tarefa Atribuída</h2>
          </div>
          
          <p style="font-size: 1.08rem; color: #334155; margin-bottom: 20px;">
            Olá <strong>${nomeResponsavel}</strong>!
          </p>
          
          <p style="font-size: 1.08rem; color: #334155; margin-bottom: 24px;">
            Uma nova tarefa foi criada e você foi designado como responsável principal.
          </p>
          
          <div style="background: #f1f5f9; padding: 20px; border-radius: 8px; margin-bottom: 24px;">
            <h3 style="color: #1e293b; margin-bottom: 16px;">Detalhes da Tarefa</h3>
            <p><strong>Assunto:</strong> ${tarefa.assunto}</p>
            <p><strong>Cliente:</strong> ${cliente?.nome || '-'} ${cliente?.cnpjCpf ? `(${cliente.cnpjCpf})` : ''}</p>
            <p><strong>Processo:</strong> ${processo?.nome || '-'}</p>
            <p><strong>Departamento:</strong> ${departamento?.nome || '-'}</p>
            <p><strong>Criado por:</strong> ${usuarioCriador.nome}</p>
            <p><strong>Data de Ação:</strong> ${formatarData(tarefa.dataAcao)}</p>
            <p><strong>Data Meta:</strong> ${formatarData(tarefa.dataMeta)}</p>
            <p><strong>Data Prazo:</strong> ${formatarData(tarefa.dataPrazo)}</p>
          </div>
          
          <div style="margin-top: 32px;">
            <h3 style="color: #1e293b; margin-bottom: 16px;">Acessar Tarefa</h3>
            <a href="${process.env.FRONTEND_URL || 'https://app.cftitan.com.br'}/gestao/${tarefa.id}/atividades" 
               style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-size: 16px; font-weight: bold;">
              Acessar Tarefa
            </a>
          </div>
          
          <p style="font-size: 0.98rem; color: #64748b; text-align: center; margin-top: 24px;">
            Este e-mail foi enviado automaticamente pelo sistema Titan.<br>
            Em caso de dúvidas, entre em contato com ${usuarioCriador.nome} (${usuarioCriador.email}).
          </p>
        </div>
      </div>
    `;
  }

  /**
   * Registra o e-mail enviado no banco de dados
   */
  async registrarEmailEnviado(tarefaId, destinatario, assunto, corpo) {
    try {
      const emailResumo = `
        <b>De:</b> Sistema Titan<br/>
        <b>Para:</b> ${destinatario}<br/>
        <b>Assunto:</b> ${assunto}<br/>
        <b>Corpo:</b><br/>${corpo}
      `.trim();

      await db.query(`
        INSERT INTO comentarios_tarefa (tarefaId, usuarioId, comentario, criadoEm)
        VALUES (?, ?, ?, NOW())
      `, [tarefaId, 1, emailResumo]); // usuarioId 1 = sistema
      
      console.log("✅ E-mail registrado no banco de dados");
    } catch (error) {
      console.error("❌ Erro ao registrar e-mail no banco:", error);
    }
  }
}

module.exports = new EmailService(); 