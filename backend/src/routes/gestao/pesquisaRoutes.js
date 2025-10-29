const express = require('express');
const router = express.Router();
const db = require("../../config/database");
const crypto = require('crypto');
const { autenticarToken } = require("../../middlewares/auth");
const axios = require('axios');
const nodemailer = require('nodemailer');

// Gera pesquisas para todos os clientes ativos de todas as empresas
router.post('/gerar', autenticarToken, async (req, res) => {
  try {
    // Busca todas as empresas que optaram por pesquisa de satisfação
    const [empresasAtivas] = await db.query('SELECT id FROM empresas WHERE pesquisaSatisfacaoAtiva = 1');
    if (!empresasAtivas.length) return res.json({ ok: true, mensagem: 'Nenhuma empresa optou por pesquisa de satisfação.' });
    const empresaIds = empresasAtivas.map(e => e.id);
    // Busca todos os clientes ativos dessas empresas
    const [clientes] = await db.query(`
      SELECT c.id as clienteId, c.empresaId
      FROM clientes c
      WHERE c.status = 'Ativo' AND c.empresaId IN (${empresaIds.map(() => '?').join(',')})
    `, empresaIds);
    if (clientes.length === 0) return res.json({ ok: true, mensagem: 'Nenhum cliente ativo elegível.' });

    const now = new Date();
    const values = [];
    const tokens = [];
    for (const c of clientes) {
      // Verifica se já existe pesquisa nos últimos 90 dias
      const [existe] = await db.query(`
        SELECT 1 FROM pesquisas_satisfacao
        WHERE clienteId = ? AND dataEnvio >= DATE_SUB(NOW(), INTERVAL 90 DAY)
        LIMIT 1
      `, [c.clienteId]);
      if (existe.length > 0) continue; // já recebeu, pula
      const token = crypto.randomBytes(24).toString('hex');
      values.push([
        c.empresaId,
        c.clienteId,
        now,
        null, // dataResposta
        null, // nota
        null, // comentario
        'enviado',
        'sem_resposta',
        token,
        now,
        now
      ]);
      tokens.push({ clienteId: c.clienteId, empresaId: c.empresaId, token });
    }
    if (values.length === 0) return res.json({ ok: true, mensagem: 'Nenhum cliente elegível para nova pesquisa.' });
    const placeholders = values.map(() => '(?,?,?,?,?,?,?,?,?,?)').join(',');
    await db.query(`
      INSERT INTO pesquisas_satisfacao
      (empresaId, clienteId, dataEnvio, dataResposta, nota, comentario, status, nps_classificacao, token, criadoEm, atualizadoEm)
      VALUES ${placeholders}
    `, values.flat());

    // Envio do e-mail e webhook para cada cliente
    for (const t of tokens) {
      // Buscar dados do cliente e empresa
      const [[cliente]] = await db.query('SELECT nome, telefone, email FROM clientes WHERE id = ?', [t.clienteId]);
      const [[empresa]] = await db.query('SELECT razaoSocial, logo_url FROM empresas WHERE id = ?', [t.empresaId]);
      const linkPesquisa = `https://app.cftitan.com.br/public/pesquisa/${t.token}`;
      // Mensagem WhatsApp mais respeitável e profissional
      const mensagemWhatsapp =
        `Olá ${cliente.nome},\n\n${empresa.nome || empresa.razaoSocial} valoriza muito a sua opinião!\n\nPor favor, dedique 1 minutinho para responder nossa pesquisa de satisfação e nos ajude a evoluir ainda mais nossos serviços.\n\n${linkPesquisa}\n\nClique no link acima para avaliar sua experiência. Sua resposta faz toda a diferença para nós!\n\nAgradecemos imensamente sua participação.\n\nEquipe ${empresa.nome || empresa.razaoSocial}`;
      const payload = {
        nome: cliente.nome,
        telefone: cliente.telefone,
        email: cliente.email,
        link: linkPesquisa,
        empresa: empresa.nome || empresa.razaoSocial,
        logo_url: empresa.logo_url,
        mensagem: mensagemWhatsapp
      };

      // Envio automático de e-mail
      if (cliente.email) {
        try {
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
          const mailOptions = {
            from: `"${empresa.nome || empresa.razaoSocial}" <${process.env.EMAIL_USER}>`,
            to: cliente.email,
            subject: 'Sua opinião é fundamental para nós! 💙 - Pesquisa de Satisfação',
            html: `
    <div style="font-family: Arial, sans-serif; background: #f8fafc; padding: 32px 0;">
      <div style="max-width: 480px; margin: 0 auto; background: #fff; border-radius: 12px; box-shadow: 0 2px 12px #e0e7ef; padding: 32px 28px;">
        <div style="text-align: center;">
          <img src="${empresa.logo_url || 'https://app.cftitan.com.br/logo.png'}" alt="Logo da empresa" style="max-width: 180px; margin-bottom: 18px; border-radius: 10px;" />
          <h2 style="color: #2563eb; margin-bottom: 8px;">Pesquisa de Satisfação</h2>
          <div style="color: #334155; font-size: 1.08rem; margin-bottom: 10px;">
            <b>Queremos ouvir você!</b>
          </div>
        </div>
        <p style="font-size: 1.08rem; color: #334155;">
          Olá <b>${cliente.nome}</b>!<br><br>
          Sua opinião é essencial para que possamos evoluir e oferecer sempre o melhor serviço.<br>
          <b>Responda nossa pesquisa rápida e ajude a transformar sua experiência!</b>
        </p>
        <div style="text-align: center; margin: 28px 0;">
          <a href="${linkPesquisa}" style="background: linear-gradient(90deg, #2563eb 60%, #60a5fa 100%); color: #fff; text-decoration: none; padding: 16px 38px; border-radius: 10px; font-size: 1.18rem; font-weight: bold; display: inline-block; box-shadow: 0 2px 8px #e0e7ef;">
            Quero dar minha opinião
          </a>
        </div>
        <p style="font-size: 0.98rem; color: #64748b; text-align: center;">
          Se preferir, copie e cole este link no navegador:<br>
          <span style="word-break: break-all; color: #2563eb;">${linkPesquisa}</span>
        </p>
        <p style="font-size: 1rem; color: #334155; margin-top: 32px; text-align: center;">
          Sua resposta faz toda a diferença para nós.<br>
          <b>Equipe ${empresa.nome || empresa.razaoSocial}</b>
        </p>
      </div>
    </div>
            `
          };
          await transporter.sendMail(mailOptions);
        } catch (err) {
          console.error('Erro ao enviar e-mail de pesquisa:', err.message);
        }
      }
      // Envio via WhatsApp (z-api)
      if (cliente.telefone) {
        const numero = cliente.telefone.replace(/\D/g, "");
        fetch("https://api.z-api.io/instances/3E49EC6B1CCDE0D5F124026A127A4111/token/A1A276E2FA5A377E1673631F/send-text", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Client-Token": "Fa1b5d1944e5248848a63467268e3fdccS"
          },
          body: JSON.stringify({
            phone: numero,
            message: mensagemWhatsapp
          })
        }).then(response => {
          console.log(`WhatsApp enviado:`, response.status);
          return response.json();
        }).then(data => {
          console.log(`Resposta Z-API:`, data);
        }).catch(error => {
          console.error(`Erro ao enviar WhatsApp:`, error);
        });
      }

      // Envio do webhook para o n8n
      try {
        await axios.post('https://auto-n8n-omega.k6fcpj.easypanel.host/webhook-test/d5925ced-7664-4438-9031-dff407f7777a', payload);
      } catch (err) {
        console.error('Erro ao enviar webhook para o n8n:', err.message);
      }
    }

    res.json({ ok: true, total: values.length });
  } catch (err) {
    console.error('Erro ao gerar pesquisas:', err);
    res.status(500).json({ error: 'Erro ao gerar pesquisas.' });
  }
});

// Recebe resposta do cliente (pública, por token)
router.post('/responder', async (req, res) => {
  const { token, nota, comentario } = req.body;
  if (!token || typeof nota !== 'number') return res.status(400).json({ error: 'Token e nota obrigatórios.' });
  try {
    // Classificação NPS - Nova nomenclatura
    let nps_classificacao = 'sem_resposta';
    if (nota >= 7) nps_classificacao = 'sala_verde'; // Sala verde a partir de nota 7
    else if (nota === 5 || nota === 6) nps_classificacao = 'sala_amarela'; // Sala amarela: notas 5 e 6
    else if (nota >= 0 && nota <= 4) nps_classificacao = 'sala_vermelha'; // Sala vermelha: notas 0 a 4

    const [result] = await db.query(`
      UPDATE pesquisas_satisfacao
      SET nota = ?, comentario = ?, dataResposta = NOW(), status = 'respondido', nps_classificacao = ?
      WHERE token = ?
    `, [nota, comentario || null, nps_classificacao, token]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Token inválido.' });
    res.json({ ok: true });
  } catch (err) {
    console.error('Erro ao registrar resposta:', err);
    res.status(500).json({ error: 'Erro ao registrar resposta.' });
  }
});

// Lista pesquisas e resultados por empresa
router.get('/:empresaId', autenticarToken, async (req, res) => {
  const { empresaId } = req.params;
  try {
    const [pesquisas] = await db.query(`
      SELECT p.*, c.nome as clienteNome
      FROM pesquisas_satisfacao p
      JOIN clientes c ON p.clienteId = c.id
      WHERE p.empresaId = ?
      ORDER BY p.dataEnvio DESC
    `, [empresaId]);
    res.json(pesquisas);
  } catch (err) {
    console.error('Erro ao buscar pesquisas:', err);
    res.status(500).json({ error: 'Erro ao buscar pesquisas.' });
  }
});

// Estatísticas das pesquisas de clientes para empresas não franqueadoras
router.get('/clientes/estatisticas/:empresaId', autenticarToken, async (req, res) => {
  const { empresaId } = req.params;
  
  try {
    // Verificar se o usuário tem permissão para a empresa
    if (req.usuario.empresaId !== parseInt(empresaId) && req.usuario.tipo !== 'admin') {
      return res.status(403).json({ error: 'Acesso negado.' });
    }

    // Verificar se a empresa optou por pesquisa de satisfação
    const [[empresa]] = await db.query(
      'SELECT pesquisaSatisfacaoAtiva, tipo_empresa FROM empresas WHERE id = ?',
      [empresaId]
    );

    if (!empresa || empresa.pesquisaSatisfacaoAtiva !== 1) {
      return res.json({
        pesquisaAtiva: false,
        message: 'Empresa não optou por pesquisa de satisfação'
      });
    }

    // Se for franqueadora, redirecionar para o endpoint específico
    if (empresa.tipo_empresa === 'franqueadora') {
      return res.json({
        isFranqueadora: true,
        message: 'Use o endpoint de franqueadora'
      });
    }

    // Buscar total de envios e respostas
    const [[totalEnvios]] = await db.query(`
      SELECT COUNT(*) as total
      FROM pesquisas_satisfacao 
      WHERE empresaId = ?
    `, [empresaId]);

    const [[totalRespostas]] = await db.query(`
      SELECT COUNT(*) as total
      FROM pesquisas_satisfacao 
      WHERE empresaId = ? AND status = 'respondido'
    `, [empresaId]);

    // Buscar todas as pesquisas respondidas da empresa
    const [pesquisas] = await db.query(`
      SELECT 
        nota,
        nps_classificacao
      FROM pesquisas_satisfacao 
      WHERE empresaId = ? AND status = 'respondido'
    `, [empresaId]);

    if (pesquisas.length === 0) {
      return res.json({
        pesquisaAtiva: true,
        isFranqueadora: false,
        total_respostas: 0,
        total_envios: totalEnvios.total,
        salas: {
          verde: 0,
          amarela: 0,
          vermelha: 0
        },
        taxa_satisfacao: 0,
        nota_media: 0
      });
    }

    // Calcular estatísticas das salas (incluindo novas classificações NPS)
    const salas = {
      verde: pesquisas.filter(p => p.nps_classificacao === 'sala_verde' || p.nps_classificacao === 'promotor').length,
      amarela: pesquisas.filter(p => p.nps_classificacao === 'sala_amarela' || p.nps_classificacao === 'passivo' || p.nps_classificacao === 'neutro').length,
      vermelha: pesquisas.filter(p => p.nps_classificacao === 'sala_vermelha' || p.nps_classificacao === 'detrator').length
    };

    // Calcular taxa de satisfação (sala verde + amarela / total)
    const totalSatisfeitos = salas.verde + salas.amarela;
    const taxaSatisfacao = Math.round((totalSatisfeitos / pesquisas.length) * 100);

    // Calcular nota média
    const somaNotas = pesquisas.reduce((acc, p) => acc + (p.nota || 0), 0);
    const notaMedia = Math.round((somaNotas / pesquisas.length) * 10) / 10;

    res.json({
      pesquisaAtiva: true,
      isFranqueadora: false,
      total_respostas: pesquisas.length,
      total_envios: totalEnvios.total,
      salas,
      taxa_satisfacao: taxaSatisfacao,
      nota_media: notaMedia
    });

  } catch (error) {
    console.error('Erro ao buscar estatísticas das pesquisas de clientes:', error);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
});

// Buscar pesquisas detalhadas de clientes
router.get('/clientes/detalhado/:empresaId', autenticarToken, async (req, res) => {
  const { empresaId } = req.params;
  
  try {
    // Verificar se o usuário tem permissão para a empresa
    if (req.usuario.empresaId !== parseInt(empresaId) && req.usuario.tipo !== 'admin') {
      return res.status(403).json({ error: 'Acesso negado.' });
    }

    // Verificar se a empresa optou por pesquisa de satisfação
    const [[empresa]] = await db.query(
      'SELECT pesquisaSatisfacaoAtiva, tipo_empresa FROM empresas WHERE id = ?',
      [empresaId]
    );

    if (!empresa || empresa.pesquisaSatisfacaoAtiva !== 1) {
      return res.status(403).json({ error: 'Empresa não optou por pesquisa de satisfação.' });
    }

    // Se for franqueadora, usar endpoint específico
    if (empresa.tipo_empresa === 'franqueadora') {
      return res.status(403).json({ error: 'Use o endpoint específico para franqueadoras.' });
    }

    // Buscar pesquisas detalhadas com informações do cliente
    const [pesquisas] = await db.query(`
      SELECT 
        p.id,
        p.clienteId,
        p.nota,
        p.nps_classificacao,
        p.dataResposta,
        p.comentario,
        p.dataEnvio,
        c.nome as cliente_nome,
        c.email as cliente_email,
        c.telefone as cliente_telefone
      FROM pesquisas_satisfacao p
      JOIN clientes c ON p.clienteId = c.id
      WHERE p.empresaId = ? AND p.status = 'respondido'
      ORDER BY p.dataResposta DESC
    `, [empresaId]);

    res.json({
      success: true,
      pesquisas: pesquisas || []
    });

  } catch (error) {
    console.error('Erro ao buscar dados detalhados de clientes:', error);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
});

// Buscar clientes sem resposta
router.get('/clientes/sem-resposta/:empresaId', autenticarToken, async (req, res) => {
  const { empresaId } = req.params;
  
  try {
    // Verificar se o usuário tem permissão para a empresa
    if (req.usuario.empresaId !== parseInt(empresaId) && req.usuario.tipo !== 'admin') {
      return res.status(403).json({ error: 'Acesso negado.' });
    }

    // Verificar se a empresa optou por pesquisa de satisfação
    const [[empresa]] = await db.query(
      'SELECT pesquisaSatisfacaoAtiva, tipo_empresa FROM empresas WHERE id = ?',
      [empresaId]
    );

    if (!empresa || empresa.pesquisaSatisfacaoAtiva !== 1) {
      return res.status(403).json({ error: 'Empresa não optou por pesquisa de satisfação.' });
    }

    // Buscar clientes que receberam pesquisa mas não responderam
    const [clientesSemResposta] = await db.query(`
      SELECT 
        c.id,
        c.nome,
        c.email,
        c.telefone,
        p.dataEnvio as data_envio
      FROM clientes c
      INNER JOIN pesquisas_satisfacao p ON c.id = p.clienteId
      WHERE c.empresaId = ? 
        AND p.empresaId = ?
        AND p.dataResposta IS NULL
        AND p.status = 'enviado'
      ORDER BY p.dataEnvio DESC
    `, [empresaId, empresaId]);

    res.json({ clientes: clientesSemResposta });
  } catch (error) {
    console.error('Erro ao buscar clientes sem resposta:', error);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
});

// Lista pesquisas de satisfação de um cliente específico
router.get('/cliente/:clienteId', autenticarToken, async (req, res) => {
  const { clienteId } = req.params;
  const { periodo } = req.query; // opcional: '3m', '6m', '1a', 'todos'
  
  try {
    let whereClause = 'WHERE p.clienteId = ?';
    const params = [clienteId];
    
    // Filtro por período
    if (periodo) {
      switch (periodo) {
        case '3m':
          whereClause += ' AND p.dataEnvio >= DATE_SUB(NOW(), INTERVAL 3 MONTH)';
          break;
        case '6m':
          whereClause += ' AND p.dataEnvio >= DATE_SUB(NOW(), INTERVAL 6 MONTH)';
          break;
        case '1a':
          whereClause += ' AND p.dataEnvio >= DATE_SUB(NOW(), INTERVAL 1 YEAR)';
          break;
        case 'todos':
        default:
          // Sem filtro de período
          break;
      }
    }
    
    const [pesquisas] = await db.query(`
      SELECT 
        p.id,
        p.dataEnvio,
        p.dataResposta,
        p.nota,
        p.comentario,
        p.status,
        p.nps_classificacao,
        p.token,
        DATE_FORMAT(p.dataEnvio, '%d/%m/%Y') as dataEnvioFormatada,
        DATE_FORMAT(p.dataResposta, '%d/%m/%Y') as dataRespostaFormatada
      FROM pesquisas_satisfacao p
      ${whereClause}
      ORDER BY p.dataEnvio DESC
    `, params);
    
    res.json(pesquisas);
  } catch (err) {
    console.error('Erro ao buscar pesquisas do cliente:', err);
    res.status(500).json({ error: 'Erro ao buscar pesquisas do cliente.' });
  }
});

// Gera pesquisa para um cliente específico (para testes)
router.post('/gerar-para-cliente', autenticarToken, async (req, res) => {
  try {
    const { clienteId, empresaId } = req.body;
    if (!clienteId) return res.status(400).json({ error: 'clienteId obrigatório' });
    // Busca empresaId se não informado
    let empId = empresaId;
    if (!empId) {
      const [cli] = await db.query('SELECT empresaId FROM clientes WHERE id = ?', [clienteId]);
      if (!cli.length) return res.status(404).json({ error: 'Cliente não encontrado' });
      empId = cli[0].empresaId;
    }
    // Verifica se a empresa optou por pesquisa de satisfação
    const [empresaPesquisa] = await db.query('SELECT pesquisaSatisfacaoAtiva FROM empresas WHERE id = ?', [empId]);
    if (!empresaPesquisa.length || empresaPesquisa[0].pesquisaSatisfacaoAtiva !== 1) {
      return res.status(403).json({ error: 'Empresa não optou por pesquisa de satisfação.' });
    }
    // Verifica se já existe pesquisa nos últimos 90 dias
    const [existe] = await db.query(`
      SELECT 1 FROM pesquisas_satisfacao
      WHERE clienteId = ? AND dataEnvio >= DATE_SUB(NOW(), INTERVAL 90 DAY)
      LIMIT 1
    `, [clienteId]);
    if (existe.length > 0) return res.status(409).json({ error: 'Já existe pesquisa recente para este cliente.' });
    const now = new Date();
    const token = require('crypto').randomBytes(24).toString('hex');
    await db.query(`
      INSERT INTO pesquisas_satisfacao
      (empresaId, clienteId, dataEnvio, status, nps_classificacao, token, criadoEm, atualizadoEm)
      VALUES (?, ?, ?, 'enviado', 'sem_resposta', ?, ?, ?)
    `, [empId, clienteId, now, token, now, now]);

    // Buscar dados do cliente e empresa
    const [[cliente]] = await db.query('SELECT nome, telefone, email FROM clientes WHERE id = ?', [clienteId]);
    const [[empresa]] = await db.query('SELECT razaoSocial, logo_url FROM empresas WHERE id = ?', [empId]);
    const linkPesquisa = `https://app.cftitan.com.br/public/pesquisa/${token}`;
    // Mensagem WhatsApp mais respeitável e profissional
    const mensagemWhatsapp =
      `Olá ${cliente.nome},\n\n${empresa.nome || empresa.razaoSocial} valoriza muito a sua opinião!\n\nPor favor, dedique 1 minutinho para responder nossa pesquisa de satisfação e nos ajude a evoluir ainda mais nossos serviços.\n\n${linkPesquisa}\n\nClique no link acima para avaliar sua experiência. Sua resposta faz toda a diferença para nós!\n\nAgradecemos imensamente sua participação.\n\nEquipe ${empresa.nome || empresa.razaoSocial}`;
    const payload = {
      nome: cliente.nome,
      telefone: cliente.telefone,
      email: cliente.email,
      link: linkPesquisa,
      empresa: empresa.nome || empresa.razaoSocial,
      logo_url: empresa.logo_url,
      mensagem: mensagemWhatsapp
    };

    // Envio automático de e-mail
    if (cliente.email) {
      try {
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
        const mailOptions = {
          from: `"${empresa.nome || empresa.razaoSocial}" <${process.env.EMAIL_USER}>`,
          to: cliente.email,
          subject: 'Sua opinião é fundamental para nós! - Pesquisa de Satisfação',
          html: `
    <div style="font-family: Arial, sans-serif; background: #f8fafc; padding: 32px 0;">
      <div style="max-width: 480px; margin: 0 auto; background: #fff; border-radius: 12px; box-shadow: 0 2px 12px #e0e7ef; padding: 32px 28px;">
        <div style="text-align: center;">
          <img src="${empresa.logo_url || 'https://app.cftitan.com.br/logo.png'}" alt="Logo da empresa" style="max-width: 180px; margin-bottom: 18px; border-radius: 10px;" />
          <h2 style="color: #2563eb; margin-bottom: 8px;">Pesquisa de Satisfação</h2>
          <div style="color: #334155; font-size: 1.08rem; margin-bottom: 10px;">
            <b>Queremos ouvir você!</b>
          </div>
        </div>
        <p style="font-size: 1.08rem; color: #334155;">
          Olá <b>${cliente.nome}</b>!<br><br>
          Sua opinião é essencial para que possamos evoluir e oferecer sempre o melhor serviço.<br>
          <b>Responda nossa pesquisa rápida e ajude a transformar sua experiência!</b>
        </p>
        <div style="text-align: center; margin: 28px 0;">
          <a href="${linkPesquisa}" style="background: linear-gradient(90deg, #2563eb 60%, #60a5fa 100%); color: #fff; text-decoration: none; padding: 16px 38px; border-radius: 10px; font-size: 1.18rem; font-weight: bold; display: inline-block; box-shadow: 0 2px 8px #e0e7ef;">
            Quero dar minha opinião
          </a>
        </div>
        <p style="font-size: 0.98rem; color: #64748b; text-align: center;">
          Se preferir, copie e cole este link no navegador:<br>
          <span style="word-break: break-all; color: #2563eb;">${linkPesquisa}</span>
        </p>
        <p style="font-size: 1rem; color: #334155; margin-top: 32px; text-align: center;">
          Sua resposta faz toda a diferença para nós.<br>
          <b>Equipe ${empresa.nome || empresa.razaoSocial}</b>
        </p>
      </div>
    </div>
            `
        };
        await transporter.sendMail(mailOptions);
      } catch (err) {
        console.error('Erro ao enviar e-mail de pesquisa:', err.message);
      }
    }
    // Envio via WhatsApp (z-api)
    if (cliente.telefone) {
      const numero = cliente.telefone.replace(/\D/g, "");
      fetch("https://api.z-api.io/instances/3E49EC6B1CCDE0D5F124026A127A4111/token/A1A276E2FA5A377E1673631F/send-text", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Client-Token": "Fa1b5d1944e5248848a63467268e3fdccS"
        },
        body: JSON.stringify({
          phone: numero,
          message: mensagemWhatsapp
        })
      }).then(() => {}).catch(() => {});
    }

    // Envio do webhook para o n8n
    try {
      await axios.post('https://auto-n8n-omega.k6fcpj.easypanel.host/webhook-test/d5925ced-7664-4438-9031-dff407f7777a', payload);
    } catch (err) {
      console.error('Erro ao enviar webhook para o n8n:', err.message);
    }

    res.json({ ok: true, token });
  } catch (err) {
    console.error('Erro ao gerar pesquisa individual:', err);
    res.status(500).json({ error: 'Erro ao gerar pesquisa individual.' });
  }
});

// Salva pesquisa manual (preenchimento manual)
router.post('/manual', autenticarToken, async (req, res) => {
  try {
    const { clienteId, dataEnvio, dataResposta, nota, comentario, status, nps_classificacao } = req.body;
    
    if (!clienteId || !dataEnvio) {
      return res.status(400).json({ error: 'clienteId e dataEnvio são obrigatórios' });
    }

    // Busca empresaId do cliente
    const [cli] = await db.query('SELECT empresaId FROM clientes WHERE id = ?', [clienteId]);
    if (!cli.length) return res.status(404).json({ error: 'Cliente não encontrado' });
    const empresaId = cli[0].empresaId;

    // Verifica se a empresa optou por pesquisa de satisfação
    const [empresaPesquisa] = await db.query('SELECT pesquisaSatisfacaoAtiva FROM empresas WHERE id = ?', [empresaId]);
    if (!empresaPesquisa.length || empresaPesquisa[0].pesquisaSatisfacaoAtiva !== 1) {
      return res.status(403).json({ error: 'Empresa não optou por pesquisa de satisfação.' });
    }

    const now = new Date();
    const token = crypto.randomBytes(24).toString('hex');

    await db.query(`
      INSERT INTO pesquisas_satisfacao
      (empresaId, clienteId, dataEnvio, dataResposta, nota, comentario, status, nps_classificacao, token, criadoEm, atualizadoEm)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      empresaId, 
      clienteId, 
      dataEnvio, 
      dataResposta || null, 
      nota || null, 
      comentario || null, 
      status || 'enviado', 
      nps_classificacao || 'sem_resposta', 
      token, 
      now, 
      now
    ]);

    res.json({ ok: true, token });
  } catch (err) {
    console.error('Erro ao salvar pesquisa manual:', err);
    res.status(500).json({ error: 'Erro ao salvar pesquisa manual.' });
  }
});

// Novo endpoint: obter info da pesquisa e logo da empresa pelo token
router.get('/info/:token', async (req, res) => {
  const { token } = req.params;
  try {
    // Busca a pesquisa pelo token
    const [[pesquisa]] = await db.query(
      `SELECT p.empresaId, e.logo_url, e.razaoSocial
       FROM pesquisas_satisfacao p
       JOIN empresas e ON p.empresaId = e.id
       WHERE p.token = ?
       LIMIT 1`,
      [token]
    );
    if (!pesquisa) {
      return res.status(404).json({ error: 'Pesquisa não encontrada para este token.' });
    }
    res.json({
      empresaId: pesquisa.empresaId,
      logo_url: pesquisa.logo_url,
      razaoSocial: pesquisa.razaoSocial,
      nome: pesquisa.nome
    });
  } catch (err) {
    console.error('Erro ao buscar info da pesquisa:', err);
    res.status(500).json({ error: 'Erro ao buscar info da pesquisa.' });
  }
});

// Nova rota: Enviar pesquisas de satisfação para franqueados selecionados
router.post('/enviar-para-franqueados', autenticarToken, async (req, res) => {
  try {
    const { franqueadoIds, enviarParaTodos, empresaId } = req.body;
    
    if (!empresaId) {
      return res.status(400).json({ error: 'empresaId é obrigatório' });
    }

    // Verificar se a empresa é franqueadora
    const [[empresa]] = await db.query(
      'SELECT tipo_empresa, razaoSocial, logo_url FROM empresas WHERE id = ?',
      [empresaId]
    );
    
    if (!empresa || empresa.tipo_empresa !== 'franqueadora') {
      return res.status(403).json({ error: 'Apenas empresas franqueadoras podem enviar pesquisas para franqueados.' });
    }

    let franqueadosParaEnviar = [];

    if (enviarParaTodos) {
      // Buscar todos os franqueados ativos da empresa
      const [todosFranqueados] = await db.query(
        'SELECT id, nome, telefone_principal, email FROM franqueados WHERE franqueadora_id = ? AND situacao = "ativo"',
        [empresaId]
      );
      franqueadosParaEnviar = todosFranqueados;
    } else if (franqueadoIds && franqueadoIds.length > 0) {
      // Buscar franqueados específicos
      const placeholders = franqueadoIds.map(() => '?').join(',');
      const [franqueadosSelecionados] = await db.query(
        `SELECT id, nome, telefone_principal, email FROM franqueados WHERE id IN (${placeholders}) AND franqueadora_id = ?`,
        [...franqueadoIds, empresaId]
      );
      franqueadosParaEnviar = franqueadosSelecionados;
    } else {
      return res.status(400).json({ error: 'Selecione franqueados ou escolha enviar para todos.' });
    }

    if (franqueadosParaEnviar.length === 0) {
      return res.status(404).json({ error: 'Nenhum franqueado encontrado para envio.' });
    }

    const now = new Date();
    const pesquisasCriadas = [];
    const tokensGerados = [];

    // Criar pesquisas para cada franqueado
    for (const franqueado of franqueadosParaEnviar) {
      // Verificar se já existe pesquisa nos últimos 90 dias
      const [existe] = await db.query(
        `SELECT 1 FROM pesquisas_satisfacao_franqueados 
         WHERE franqueado_id = ? AND data_envio >= DATE_SUB(NOW(), INTERVAL 90 DAY)
         LIMIT 1`,
        [franqueado.id]
      );
      
      if (existe.length > 0) continue; // já recebeu, pula

      const token = crypto.randomBytes(24).toString('hex');
      
      // Inserir na nova tabela de pesquisas de franqueados
      await db.query(`
        INSERT INTO pesquisas_satisfacao_franqueados
        (empresa_id, franqueado_id, token, status, data_envio, criado_em, atualizado_em)
        VALUES (?, ?, ?, 'enviado', ?, ?, ?)
      `, [empresaId, franqueado.id, token, now, now, now]);

      const linkPesquisa = `https://app.cftitan.com.br/public/pesquisa-franqueado/${token}`;
      
      // Mensagem WhatsApp para franqueados
      const mensagemWhatsapp = `Olá ${franqueado.nome},\n\n${empresa.razaoSocial} valoriza muito a sua opinião!\n\nPor favor, dedique alguns minutos para responder nossa pesquisa de satisfação e nos ajude a evoluir ainda mais nossos serviços.\n\n${linkPesquisa}\n\nClique no link acima para avaliar sua experiência. Sua resposta faz toda a diferença para nós!\n\nAgradecemos imensamente sua participação.\n\nEquipe ${empresa.razaoSocial}`;

      const payload = {
        nome: franqueado.nome,
        telefone: franqueado.telefone_principal,
        email: franqueado.email,
        link: linkPesquisa,
        empresa: empresa.razaoSocial,
        logo_url: empresa.logo_url,
        mensagem: mensagemWhatsapp,
        tipo: 'franqueado'
      };

      // Envio automático de e-mail
      if (franqueado.email) {
        try {
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
          
          const mailOptions = {
            from: `"${empresa.razaoSocial}" <${process.env.EMAIL_USER}>`,
            to: franqueado.email,
            subject: 'Sua opinião é fundamental para nós! 💙 - Pesquisa de Satisfação',
            html: `
              <div style="font-family: Arial, sans-serif; background: #f8fafc; padding: 32px 0;">
                <div style="max-width: 480px; margin: 0 auto; background: #fff; border-radius: 12px; box-shadow: 0 2px 12px #e0e7ef; padding: 32px 28px;">
                  <div style="text-align: center;">
                    <img src="${empresa.logo_url || 'https://app.cftitan.com.br/logo.png'}" alt="Logo da empresa" style="max-width: 180px; margin-bottom: 18px; border-radius: 10px;" />
                    <h2 style="color: #2563eb; margin-bottom: 8px;">Pesquisa de Satisfação</h2>
                    <div style="color: #334155; font-size: 1.08rem; margin-bottom: 10px;">
                      <b>Queremos ouvir você!</b>
                    </div>
                  </div>
                  <p style="font-size: 1.08rem; color: #334155;">
                    Olá <b>${franqueado.nome}</b>!<br><br>
                    Sua opinião é essencial para que possamos evoluir e oferecer sempre o melhor serviço.<br>
                    <b>Responda nossa pesquisa rápida e ajude a transformar sua experiência!</b>
                  </p>
                  <div style="text-align: center; margin: 28px 0;">
                    <a href="${linkPesquisa}" style="background: linear-gradient(90deg, #2563eb 60%, #60a5fa 100%); color: #fff; text-decoration: none; padding: 16px 38px; border-radius: 10px; font-size: 1.18rem; font-weight: bold; display: inline-block; box-shadow: 0 2px 8px #e0e7ef;">
                      Quero dar minha opinião
                    </a>
                  </div>
                  <p style="font-size: 0.98rem; color: #64748b; text-align: center;">
                    Se preferir, copie e cole este link no navegador:<br>
                    <span style="word-break: break-all; color: #2563eb;">${linkPesquisa}</span>
                  </p>
                  <p style="font-size: 1rem; color: #334155; margin-top: 32px; text-align: center;">
                    Sua resposta faz toda a diferença para nós.<br>
                    <b>Equipe ${empresa.razaoSocial}</b>
                  </p>
                </div>
              </div>
            `
          };
          
          await transporter.sendMail(mailOptions);
        } catch (err) {
          console.error('Erro ao enviar e-mail de pesquisa para franqueado:', err.message);
        }
      }

      // Envio via WhatsApp (z-api)
      if (franqueado.telefone_principal) {
        const numero = franqueado.telefone_principal.replace(/\D/g, "");
        fetch("https://api.z-api.io/instances/3E49EC6B1CCDE0D5F124026A127A4111/token/A1A276E2FA5A377E1673631F/send-text", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Client-Token": "Fa1b5d1944e5248848a63467268e3fdccS"
          },
          body: JSON.stringify({
            phone: numero,
            message: mensagemWhatsapp
          })
        }).then(response => {
          console.log(`WhatsApp enviado:`, response.status);
          return response.json();
        }).then(data => {
          console.log(`Resposta Z-API:`, data);
        }).catch(error => {
          console.error(`Erro ao enviar WhatsApp:`, error);
        });
      }

      // Envio do webhook para o n8n
      try {
        await axios.post('https://auto-n8n-omega.k6fcpj.easypanel.host/webhook-test/d5925ced-7664-4438-9031-dff407f7777a', payload);
      } catch (err) {
        console.error('Erro ao enviar webhook para o n8n:', err.message);
      }

      pesquisasCriadas.push(franqueado.nome);
      tokensGerados.push({ franqueadoId: franqueado.id, token });
    }

    res.json({ 
      success: true, 
      message: `${pesquisasCriadas.length} pesquisas enviadas com sucesso`,
      pesquisasCriadas,
      tokensGerados
    });

  } catch (err) {
    console.error('Erro ao enviar pesquisas para franqueados:', err);
    res.status(500).json({ error: 'Erro ao enviar pesquisas para franqueados.' });
  }
});

// Nova rota: Enviar pesquisas de satisfação para franqueados com limite de 50
router.post('/enviar-para-franqueados-limitada', autenticarToken, async (req, res) => {
  try {
    const { franqueadoIds, enviarParaTodos, empresaId } = req.body;
    
    if (!empresaId) {
      return res.status(400).json({ error: 'empresaId é obrigatório' });
    }

    // Verificar se a empresa é franqueadora
    const [[empresa]] = await db.query(
      'SELECT tipo_empresa, razaoSocial, logo_url FROM empresas WHERE id = ?',
      [empresaId]
    );
    
    if (!empresa || empresa.tipo_empresa !== 'franqueadora') {
      return res.status(403).json({ error: 'Empresa não é franqueadora ou não encontrada.' });
    }

    // Verificar se a empresa optou por pesquisa de satisfação
    const [empresaPesquisa] = await db.query('SELECT pesquisaSatisfacaoAtiva FROM empresas WHERE id = ?', [empresaId]);
    if (!empresaPesquisa.length || empresaPesquisa[0].pesquisaSatisfacaoAtiva !== 1) {
      return res.status(403).json({ error: 'Empresa não optou por pesquisa de satisfação.' });
    }

    let franqueadosParaEnviar = [];

    if (enviarParaTodos) {
      // Buscar todos os franqueados ativos com LIMIT 50
      const [franqueados] = await db.query(`
        SELECT id, nome, unidade, telefone_principal, email
        FROM franqueados 
        WHERE franqueadora_id = ? AND situacao = 'ativo'
        ORDER BY id ASC
        LIMIT 50
      `, [empresaId]);
      
      franqueadosParaEnviar = franqueados;
    } else if (franqueadoIds && franqueadoIds.length > 0) {
      // Verificar se não excede o limite de 50
      if (franqueadoIds.length > 50) {
        return res.status(400).json({ error: 'Máximo de 50 franqueados por envio.' });
      }
      
      // Buscar franqueados específicos
      const placeholders = franqueadoIds.map(() => '?').join(',');
      const [franqueados] = await db.query(`
        SELECT id, nome, unidade, telefone_principal, email
        FROM franqueados 
        WHERE franqueadora_id = ? AND id IN (${placeholders}) AND situacao = 'ativo'
      `, [empresaId, ...franqueadoIds]);
      
      franqueadosParaEnviar = franqueados;
    } else {
      return res.status(400).json({ error: 'Selecione franqueados ou marque "enviar para todos".' });
    }

    if (franqueadosParaEnviar.length === 0) {
      return res.status(404).json({ error: 'Nenhum franqueado ativo encontrado.' });
    }

    const pesquisasCriadas = [];
    const tokensGerados = [];
    const now = new Date();

    // Mensagem WhatsApp para franqueados (será atualizada com o link específico de cada franqueado)
    const mensagemWhatsappBase = `Olá! 👋\n\n${empresa.razaoSocial} valoriza muito a sua opinião como franqueado!\n\nPor favor, dedique 1 minutinho para responder nossa pesquisa de satisfação e nos ajude a evoluir ainda mais nossos serviços.\n\nSua resposta faz toda a diferença para nós!\n\nEquipe ${empresa.razaoSocial}`;

    for (const franqueado of franqueadosParaEnviar) {
      // Verificar se já existe pesquisa nos últimos 90 dias para este franqueado
      const [existe] = await db.query(`
        SELECT 1 FROM pesquisas_satisfacao_franqueados
        WHERE franqueado_id = ? AND data_envio >= DATE_SUB(NOW(), INTERVAL 90 DAY)
        LIMIT 1
      `, [franqueado.id]);
      
      if (existe.length > 0) {
        console.log(`Pesquisa já enviada recentemente para franqueado ${franqueado.nome}`);
        continue; // Pular este franqueado
      }

      const token = crypto.randomBytes(24).toString('hex');
      const linkPesquisa = `https://app.cftitan.com.br/public/pesquisa-franqueado/${token}`;

      // Inserir pesquisa no banco
      await db.query(`
        INSERT INTO pesquisas_satisfacao_franqueados
        (empresa_id, franqueado_id, data_envio, status, nps_classificacao, token, criado_em, atualizado_em)
        VALUES (?, ?, ?, 'enviado', 'sem_resposta', ?, ?, ?)
      `, [empresaId, franqueado.id, now, token, now, now]);

      // Criar mensagem WhatsApp específica com o link
      const mensagemWhatsapp = `${mensagemWhatsappBase}\n\n🔗 Link da pesquisa: ${linkPesquisa}`;

      // Preparar payload para webhook
      const payload = {
        nome: franqueado.nome,
        unidade: franqueado.unidade,
        telefone: franqueado.telefone_principal,
        email: franqueado.email,
        link: linkPesquisa,
        empresa: empresa.razaoSocial,
        logo_url: empresa.logo_url,
        mensagem: mensagemWhatsapp
      };

      // Envio via e-mail
      if (franqueado.email) {
        try {
          const transporter = nodemailer.createTransporter({
            host: process.env.EMAIL_HOST,
            port: parseInt(process.env.EMAIL_PORT),
            secure: parseInt(process.env.EMAIL_PORT) === 465,
            auth: {
              user: process.env.EMAIL_USER,
              pass: process.env.EMAIL_PASS,
            },
          });

          const mailOptions = {
            from: `"${empresa.razaoSocial}" <${process.env.EMAIL_USER}>`,
            to: franqueado.email,
            subject: `Pesquisa de Satisfação - ${empresa.razaoSocial}`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center; border-radius: 10px 10px 0 0;">
                  ${empresa.logo_url ? `<img src="${empresa.logo_url}" alt="${empresa.razaoSocial}" style="max-height: 60px; margin-bottom: 20px;">` : ''}
                  <h1 style="color: #ffffff; margin: 0; font-size: 1.8rem;">Pesquisa de Satisfação</h1>
                  <p style="color: #e0e7ff; margin: 10px 0 0 0; font-size: 1.1rem;">Sua opinião é muito importante para nós!</p>
                </div>
                <div style="padding: 40px 30px; background: #ffffff; border-radius: 0 0 10px 10px; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
                  <h2 style="color: #1f2937; margin: 0 0 20px 0; font-size: 1.4rem;">Olá, ${franqueado.nome}!</h2>
                  <p style="color: #4b5563; line-height: 1.6; margin: 0 0 25px 0; font-size: 1rem;">
                    A <strong>${empresa.razaoSocial}</strong> valoriza muito a sua opinião como franqueado!
                  </p>
                  <p style="color: #4b5563; line-height: 1.6; margin: 0 0 30px 0; font-size: 1rem;">
                    Por favor, dedique apenas 1 minutinho para responder nossa pesquisa de satisfação e nos ajude a evoluir ainda mais nossos serviços.
                  </p>
                  <div style="text-align: center; margin: 35px 0;">
                    <a href="${linkPesquisa}" style="background: linear-gradient(90deg, #2563eb 60%, #60a5fa 100%); color: #fff; text-decoration: none; padding: 16px 38px; border-radius: 10px; font-size: 1.18rem; font-weight: bold; display: inline-block; box-shadow: 0 2px 8px #e0e7ef;">
                      Quero dar minha opinião
                    </a>
                  </div>
                  <p style="font-size: 0.98rem; color: #64748b; text-align: center;">
                    Se preferir, copie e cole este link no navegador:<br>
                    <span style="word-break: break-all; color: #2563eb;">${linkPesquisa}</span>
                  </p>
                  <p style="font-size: 1rem; color: #334155; margin-top: 32px; text-align: center;">
                    Sua resposta faz toda a diferença para nós.<br>
                    <b>Equipe ${empresa.razaoSocial}</b>
                  </p>
                </div>
              </div>
            `
          };
          
          await transporter.sendMail(mailOptions);
        } catch (err) {
          console.error('Erro ao enviar e-mail de pesquisa para franqueado:', err.message);
        }
      }

      // Envio via WhatsApp (z-api)
      if (franqueado.telefone_principal) {
        const numero = franqueado.telefone_principal.replace(/\D/g, "");
        fetch("https://api.z-api.io/instances/3E49EC6B1CCDE0D5F124026A127A4111/token/A1A276E2FA5A377E1673631F/send-text", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Client-Token": "Fa1b5d1944e5248848a63467268e3fdccS"
          },
          body: JSON.stringify({
            phone: numero,
            message: mensagemWhatsapp
          })
        }).then(response => {
          console.log(`WhatsApp enviado:`, response.status);
          return response.json();
        }).then(data => {
          console.log(`Resposta Z-API:`, data);
        }).catch(error => {
          console.error(`Erro ao enviar WhatsApp:`, error);
        });
      }

      // Envio do webhook para o n8n
      try {
        await axios.post('https://auto-n8n-omega.k6fcpj.easypanel.host/webhook-test/d5925ced-7664-4438-9031-dff407f7777a', payload);
      } catch (err) {
        console.error('Erro ao enviar webhook para o n8n:', err.message);
      }

      pesquisasCriadas.push(franqueado.nome);
      tokensGerados.push({ franqueadoId: franqueado.id, token });
    }

    res.json({ 
      success: true, 
      message: `${pesquisasCriadas.length} pesquisas enviadas com sucesso (máximo 50)`,
      pesquisasCriadas,
      tokensGerados,
      limite: 50,
      totalEnviadas: pesquisasCriadas.length
    });

  } catch (err) {
    console.error('Erro ao enviar pesquisas para franqueados (limitada):', err);
    res.status(500).json({ error: 'Erro ao enviar pesquisas para franqueados.' });
  }
});

// Nova rota: Enviar pesquisas para franqueados de forma inteligente (pula duplicatas e completa 50 envios)
router.post('/enviar-para-franqueados-inteligente', autenticarToken, async (req, res) => {
  try {
    const { empresaId, limite = 50, franqueadoId } = req.body;
    
    if (!empresaId) {
      return res.status(400).json({ error: 'empresaId é obrigatório' });
    }

    // Verificar se a empresa é franqueadora
    const [[empresa]] = await db.query(
      'SELECT tipo_empresa, razaoSocial, logo_url FROM empresas WHERE id = ?',
      [empresaId]
    );
    
    if (!empresa || empresa.tipo_empresa !== 'franqueadora') {
      return res.status(403).json({ error: 'Empresa não é franqueadora ou não encontrada.' });
    }

    // Verificar se a empresa optou por pesquisa de satisfação
    const [empresaPesquisa] = await db.query('SELECT pesquisaSatisfacaoAtiva FROM empresas WHERE id = ?', [empresaId]);
    if (!empresaPesquisa.length || empresaPesquisa[0].pesquisaSatisfacaoAtiva !== 1) {
      return res.status(403).json({ error: 'Empresa não optou por pesquisa de satisfação.' });
    }

    const pesquisasCriadas = [];
    const tokensGerados = [];
    const franqueadosPulados = [];
    const now = new Date();
    let offset = 0;
    const batchSize = 100; // Buscar em lotes de 100
    let totalProcessados = 0;
    let totalEnviados = 0;

    // Mensagem WhatsApp para franqueados
    const mensagemWhatsappBase = `Olá! 👋\n\n${empresa.razaoSocial} valoriza muito a sua opinião como franqueado!\n\nPor favor, dedique 1 minutinho para responder nossa pesquisa de satisfação e nos ajude a evoluir ainda mais nossos serviços.\n\nSua resposta faz toda a diferença para nós!\n\nEquipe ${empresa.razaoSocial}`;

    // Se franqueadoId foi especificado, enviar apenas para esse franqueado (modo teste)
    if (franqueadoId) {
      // Buscar franqueado específico
      const [franqueados] = await db.query(`
        SELECT id, nome, unidade, telefone_principal, email
        FROM franqueados 
        WHERE franqueadora_id = ? AND id = ? AND situacao = 'ativo'
        LIMIT 1
      `, [empresaId, franqueadoId]);

      if (franqueados.length === 0) {
        return res.status(404).json({ error: 'Franqueado não encontrado ou inativo.' });
      }

      const franqueado = franqueados[0];
      totalProcessados = 1;

      // Verificar se já existe pesquisa nos últimos 90 dias para este franqueado
      const [existe] = await db.query(`
        SELECT 1 FROM pesquisas_satisfacao_franqueados
        WHERE franqueado_id = ? AND data_envio >= DATE_SUB(NOW(), INTERVAL 90 DAY)
        LIMIT 1
      `, [franqueado.id]);
      
      if (existe.length > 0) {
        return res.status(409).json({ 
          error: 'Pesquisa já enviada para este franqueado nos últimos 90 dias.',
          franqueado: {
            id: franqueado.id,
            nome: franqueado.nome,
            motivo: 'Pesquisa já enviada nos últimos 90 dias'
          }
        });
      }

      // Processar envio para o franqueado específico
      const token = crypto.randomBytes(24).toString('hex');
      const linkPesquisa = `https://app.cftitan.com.br/public/pesquisa-franqueado/${token}`;

      // Inserir pesquisa no banco
      await db.query(`
        INSERT INTO pesquisas_satisfacao_franqueados
        (empresa_id, franqueado_id, data_envio, status, nps_classificacao, token, criado_em, atualizado_em)
        VALUES (?, ?, ?, 'enviado', 'sem_resposta', ?, ?, ?)
      `, [empresaId, franqueado.id, now, token, now, now]);

      // Criar mensagem WhatsApp específica com o link
      const mensagemWhatsapp = `${mensagemWhatsappBase}\n\n🔗 Link da pesquisa: ${linkPesquisa}`;

      // Preparar payload para webhook
      const payload = {
        nome: franqueado.nome,
        unidade: franqueado.unidade,
        telefone: franqueado.telefone_principal,
        email: franqueado.email,
        link: linkPesquisa,
        empresa: empresa.razaoSocial,
        logo_url: empresa.logo_url,
        mensagem: mensagemWhatsapp
      };

      // Envio via e-mail
      if (franqueado.email) {
        try {
          const transporter = nodemailer.createTransporter({
            host: process.env.EMAIL_HOST,
            port: parseInt(process.env.EMAIL_PORT),
            secure: parseInt(process.env.EMAIL_PORT) === 465,
            auth: {
              user: process.env.EMAIL_USER,
              pass: process.env.EMAIL_PASS,
            },
          });

          const mailOptions = {
            from: `"${empresa.razaoSocial}" <${process.env.EMAIL_USER}>`,
            to: franqueado.email,
            subject: `Pesquisa de Satisfação - ${empresa.razaoSocial}`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center; border-radius: 10px 10px 0 0;">
                  ${empresa.logo_url ? `<img src="${empresa.logo_url}" alt="${empresa.razaoSocial}" style="max-height: 60px; margin-bottom: 20px;">` : ''}
                  <h1 style="color: #ffffff; margin: 0; font-size: 1.8rem;">Pesquisa de Satisfação</h1>
                  <p style="color: #e0e7ff; margin: 10px 0 0 0; font-size: 1.1rem;">Sua opinião é muito importante para nós!</p>
                </div>
                <div style="padding: 40px 30px; background: #ffffff; border-radius: 0 0 10px 10px; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
                  <h2 style="color: #1f2937; margin: 0 0 20px 0; font-size: 1.4rem;">Olá, ${franqueado.nome}!</h2>
                  <p style="color: #4b5563; line-height: 1.6; margin: 0 0 25px 0; font-size: 1rem;">
                    A <strong>${empresa.razaoSocial}</strong> valoriza muito a sua opinião como franqueado!
                  </p>
                  <p style="color: #4b5563; line-height: 1.6; margin: 0 0 30px 0; font-size: 1rem;">
                    Por favor, dedique apenas 1 minutinho para responder nossa pesquisa de satisfação e nos ajude a evoluir ainda mais nossos serviços.
                  </p>
                  <div style="text-align: center; margin: 35px 0;">
                    <a href="${linkPesquisa}" style="background: linear-gradient(90deg, #2563eb 60%, #60a5fa 100%); color: #fff; text-decoration: none; padding: 16px 38px; border-radius: 10px; font-size: 1.18rem; font-weight: bold; display: inline-block; box-shadow: 0 2px 8px #e0e7ef;">
                      Quero dar minha opinião
                    </a>
                  </div>
                  <p style="font-size: 0.98rem; color: #64748b; text-align: center;">
                    Se preferir, copie e cole este link no navegador:<br>
                    <span style="word-break: break-all; color: #2563eb;">${linkPesquisa}</span>
                  </p>
                  <p style="font-size: 1rem; color: #334155; margin-top: 32px; text-align: center;">
                    Sua resposta faz toda a diferença para nós.<br>
                    <b>Equipe ${empresa.razaoSocial}</b>
                  </p>
                </div>
              </div>
            `
          };
          
          await transporter.sendMail(mailOptions);
        } catch (err) {
          console.error('Erro ao enviar e-mail de pesquisa para franqueado:', err.message);
        }
      }

      // Envio via WhatsApp (z-api) com delay
      if (franqueado.telefone_principal) {
        const numero = franqueado.telefone_principal.replace(/\D/g, "");
        console.log(`Enviando WhatsApp para ${franqueado.nome} (modo teste) - Número: ${numero}`);
        
        // Delay de 10-15 segundos entre mensagens para evitar spam/ban
        const delay = 10000 + Math.random() * 5000; // 10-15 segundos
        console.log(`Aguardando ${Math.round(delay/1000)}s antes de enviar para ${franqueado.nome} (modo teste)...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        
        fetch("https://api.z-api.io/instances/3E49EC6B1CCDE0D5F124026A127A4111/token/A1A276E2FA5A377E1673631F/send-text", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Client-Token": "Fa1b5d1944e5248848a63467268e3fdccS"
          },
          body: JSON.stringify({
            phone: numero,
            message: mensagemWhatsapp
          })
        }).then(response => {
          console.log(`WhatsApp enviado para ${franqueado.nome} (modo teste):`, response.status);
          return response.json();
        }).then(data => {
          console.log(`Resposta Z-API para ${franqueado.nome} (modo teste):`, data);
        }).catch(error => {
          console.error(`Erro ao enviar WhatsApp para ${franqueado.nome} (modo teste):`, error);
        });
      } else {
        console.log(`Franqueado ${franqueado.nome} (modo teste) não tem telefone principal`);
      }

      // Envio do webhook para o n8n
      try {
        await axios.post('https://auto-n8n-omega.k6fcpj.easypanel.host/webhook-test/d5925ced-7664-4438-9031-dff407f7777a', payload);
      } catch (err) {
        console.error('Erro ao enviar webhook para o n8n:', err.message);
      }

      pesquisasCriadas.push(franqueado.nome);
      tokensGerados.push({ franqueadoId: franqueado.id, token });
      totalEnviados = 1;

      // Buscar estatísticas finais
      const [totalFranqueados] = await db.query(
        'SELECT COUNT(*) as total FROM franqueados WHERE franqueadora_id = ? AND situacao = "ativo"',
        [empresaId]
      );

      return res.json({ 
        success: true, 
        message: `Pesquisa enviada com sucesso para ${franqueado.nome} (modo teste)`,
        estatisticas: {
          totalEnviados: 1,
          totalPulados: 0,
          totalProcessados: 1,
          totalFranqueados: totalFranqueados[0].total,
          limiteSolicitado: 1,
          modo: 'teste'
        },
        pesquisasCriadas,
        tokensGerados,
        franqueadoTeste: {
          id: franqueado.id,
          nome: franqueado.nome,
          unidade: franqueado.unidade,
          email: franqueado.email,
          telefone: franqueado.telefone_principal,
          link: linkPesquisa
        }
      });
    }

    // Loop principal: continuar até completar o limite ou não haver mais franqueados
    while (totalEnviados < limite) {
      // Buscar próximo lote de franqueados ativos
      const [franqueados] = await db.query(`
        SELECT id, nome, unidade, telefone_principal, email
        FROM franqueados 
        WHERE franqueadora_id = ? AND situacao = 'ativo'
        ORDER BY id ASC
        LIMIT ? OFFSET ?
      `, [empresaId, batchSize, offset]);

      // Se não há mais franqueados, parar
      if (franqueados.length === 0) {
        break;
      }

      totalProcessados += franqueados.length;

      // Processar cada franqueado do lote atual
      for (const franqueado of franqueados) {
        // Se já atingiu o limite, parar
        if (totalEnviados >= limite) {
          break;
        }

        // Verificar se já existe pesquisa nos últimos 90 dias para este franqueado
        const [existe] = await db.query(`
          SELECT 1 FROM pesquisas_satisfacao_franqueados
          WHERE franqueado_id = ? AND data_envio >= DATE_SUB(NOW(), INTERVAL 90 DAY)
          LIMIT 1
        `, [franqueado.id]);
        
        if (existe.length > 0) {
          franqueadosPulados.push({
            id: franqueado.id,
            nome: franqueado.nome,
            motivo: 'Pesquisa já enviada nos últimos 90 dias'
          });
          continue; // Pular este franqueado
        }

        // Criar pesquisa para este franqueado
        const token = crypto.randomBytes(24).toString('hex');
        const linkPesquisa = `https://app.cftitan.com.br/public/pesquisa-franqueado/${token}`;

        // Inserir pesquisa no banco
        await db.query(`
          INSERT INTO pesquisas_satisfacao_franqueados
          (empresa_id, franqueado_id, data_envio, status, nps_classificacao, token, criado_em, atualizado_em)
          VALUES (?, ?, ?, 'enviado', 'sem_resposta', ?, ?, ?)
        `, [empresaId, franqueado.id, now, token, now, now]);

        // Criar mensagem WhatsApp específica com o link
        const mensagemWhatsapp = `${mensagemWhatsappBase}\n\n🔗 Link da pesquisa: ${linkPesquisa}`;

        // Preparar payload para webhook
        const payload = {
          nome: franqueado.nome,
          unidade: franqueado.unidade,
          telefone: franqueado.telefone_principal,
          email: franqueado.email,
          link: linkPesquisa,
          empresa: empresa.razaoSocial,
          logo_url: empresa.logo_url,
          mensagem: mensagemWhatsapp
        };

        // Envio via e-mail
        if (franqueado.email) {
          try {
            const transporter = nodemailer.createTransporter({
              host: process.env.EMAIL_HOST,
              port: parseInt(process.env.EMAIL_PORT),
              secure: parseInt(process.env.EMAIL_PORT) === 465,
              auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS,
              },
            });

            const mailOptions = {
              from: `"${empresa.razaoSocial}" <${process.env.EMAIL_USER}>`,
              to: franqueado.email,
              subject: `Pesquisa de Satisfação - ${empresa.razaoSocial}`,
              html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
                  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center; border-radius: 10px 10px 0 0;">
                    ${empresa.logo_url ? `<img src="${empresa.logo_url}" alt="${empresa.razaoSocial}" style="max-height: 60px; margin-bottom: 20px;">` : ''}
                    <h1 style="color: #ffffff; margin: 0; font-size: 1.8rem;">Pesquisa de Satisfação</h1>
                    <p style="color: #e0e7ff; margin: 10px 0 0 0; font-size: 1.1rem;">Sua opinião é muito importante para nós!</p>
                  </div>
                  <div style="padding: 40px 30px; background: #ffffff; border-radius: 0 0 10px 10px; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
                    <h2 style="color: #1f2937; margin: 0 0 20px 0; font-size: 1.4rem;">Olá, ${franqueado.nome}!</h2>
                    <p style="color: #4b5563; line-height: 1.6; margin: 0 0 25px 0; font-size: 1rem;">
                      A <strong>${empresa.razaoSocial}</strong> valoriza muito a sua opinião como franqueado!
                    </p>
                    <p style="color: #4b5563; line-height: 1.6; margin: 0 0 30px 0; font-size: 1rem;">
                      Por favor, dedique apenas 1 minutinho para responder nossa pesquisa de satisfação e nos ajude a evoluir ainda mais nossos serviços.
                    </p>
                    <div style="text-align: center; margin: 35px 0;">
                      <a href="${linkPesquisa}" style="background: linear-gradient(90deg, #2563eb 60%, #60a5fa 100%); color: #fff; text-decoration: none; padding: 16px 38px; border-radius: 10px; font-size: 1.18rem; font-weight: bold; display: inline-block; box-shadow: 0 2px 8px #e0e7ef;">
                        Quero dar minha opinião
                      </a>
                    </div>
                    <p style="font-size: 0.98rem; color: #64748b; text-align: center;">
                      Se preferir, copie e cole este link no navegador:<br>
                      <span style="word-break: break-all; color: #2563eb;">${linkPesquisa}</span>
                    </p>
                    <p style="font-size: 1rem; color: #334155; margin-top: 32px; text-align: center;">
                      Sua resposta faz toda a diferença para nós.<br>
                      <b>Equipe ${empresa.razaoSocial}</b>
                    </p>
                  </div>
                </div>
              `
            };
            
            await transporter.sendMail(mailOptions);
          } catch (err) {
            console.error('Erro ao enviar e-mail de pesquisa para franqueado:', err.message);
          }
        }

        // Envio via WhatsApp (z-api) com delay
        if (franqueado.telefone_principal) {
          const numero = franqueado.telefone_principal.replace(/\D/g, "");
          console.log(`Enviando WhatsApp para ${franqueado.nome} - Número: ${numero}`);
          
          // Delay de 10-15 segundos entre mensagens para evitar spam/ban
          const delay = 10000 + Math.random() * 5000; // 10-15 segundos
          console.log(`Aguardando ${Math.round(delay/1000)}s antes de enviar para ${franqueado.nome}...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          
          fetch("https://api.z-api.io/instances/3E49EC6B1CCDE0D5F124026A127A4111/token/A1A276E2FA5A377E1673631F/send-text", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Client-Token": "Fa1b5d1944e5248848a63467268e3fdccS"
            },
            body: JSON.stringify({
              phone: numero,
              message: mensagemWhatsapp
            })
          }).then(response => {
            console.log(`WhatsApp enviado para ${franqueado.nome}:`, response.status);
            return response.json();
          }).then(data => {
            console.log(`Resposta Z-API para ${franqueado.nome}:`, data);
          }).catch(error => {
            console.error(`Erro ao enviar WhatsApp para ${franqueado.nome}:`, error);
          });
        } else {
          console.log(`Franqueado ${franqueado.nome} não tem telefone principal`);
        }

        // Envio do webhook para o n8n
        try {
          await axios.post('https://auto-n8n-omega.k6fcpj.easypanel.host/webhook-test/d5925ced-7664-4438-9031-dff407f7777a', payload);
        } catch (err) {
          console.error('Erro ao enviar webhook para o n8n:', err.message);
        }

        pesquisasCriadas.push(franqueado.nome);
        tokensGerados.push({ franqueadoId: franqueado.id, token });
        totalEnviados++;
      }

      // Avançar para o próximo lote
      offset += batchSize;
    }

    // Buscar estatísticas finais
    const [totalFranqueados] = await db.query(
      'SELECT COUNT(*) as total FROM franqueados WHERE franqueadora_id = ? AND situacao = "ativo"',
      [empresaId]
    );

    res.json({ 
      success: true, 
      message: `${totalEnviados} pesquisas enviadas com sucesso (limite: ${limite})`,
      estatisticas: {
        totalEnviados,
        totalPulados: franqueadosPulados.length,
        totalProcessados,
        totalFranqueados: totalFranqueados[0].total,
        limiteSolicitado: limite
      },
      pesquisasCriadas,
      tokensGerados,
      franqueadosPulados: franqueadosPulados.slice(0, 10), // Mostrar apenas os primeiros 10 pulados
      proximosPassos: totalEnviados < limite ? 
        `Para enviar mais pesquisas, execute novamente a rota. Restam ${limite - totalEnviados} envios disponíveis.` :
        'Limite de envios atingido com sucesso!'
    });

  } catch (err) {
    console.error('Erro ao enviar pesquisas para franqueados (inteligente):', err);
    res.status(500).json({ error: 'Erro ao enviar pesquisas para franqueados.' });
  }
});

// Rotas específicas para pesquisas de franqueados
router.get('/franqueado/info/:token', async (req, res) => {
  const { token } = req.params;
  try {
    // Busca a pesquisa de franqueado pelo token
    const [[pesquisa]] = await db.query(
      `SELECT psf.empresa_id, e.logo_url, e.razaoSocial, f.nome as nome_franqueado, f.unidade
       FROM pesquisas_satisfacao_franqueados psf
       JOIN empresas e ON psf.empresa_id = e.id
       JOIN franqueados f ON psf.franqueado_id = f.id
       WHERE psf.token = ? AND psf.status = 'enviado'
       LIMIT 1`,
      [token]
    );
    
    if (!pesquisa) {
      return res.status(404).json({ error: 'Pesquisa não encontrada ou já respondida.' });
    }
    
    res.json({
      empresaId: pesquisa.empresa_id,
      logo_url: pesquisa.logo_url,
      razaoSocial: pesquisa.razaoSocial,
      nomeFranqueado: pesquisa.nome_franqueado,
      unidade: pesquisa.unidade
    });
  } catch (err) {
    console.error('Erro ao buscar info da pesquisa de franqueado:', err);
    res.status(500).json({ error: 'Erro ao buscar informações da pesquisa.' });
  }
});

router.post('/franqueado/responder', async (req, res) => {
  const { 
    token, 
    notaSatisfacaoGeral, 
    comentarioGeral,
    notaAtendimento,
    notaTi,
    notaParceiros,
    comentarioAtendimento,
    comentarioTi,
    comentarioParceiros,
    utilizaBackofficePessoal,
    utilizaBackofficeFiscal,
    utilizaBackofficeContabil,
    naoUtilizaBackoffice,
    notaDepPessoal,
    notaDemandasPessoal,
    comentarioPessoal,
    notaDepFiscal,
    notaDemandasFiscal,
    comentarioFiscal,
    notaDepContabil,
    notaDemandasContabil,
    comentarioContabil
  } = req.body;
  
  if (!token || typeof notaSatisfacaoGeral !== 'number') {
    return res.status(400).json({ error: 'Token e nota de satisfação geral são obrigatórios.' });
  }
  
  try {
    // Verificar se a pesquisa existe e não foi respondida
    const [[pesquisa]] = await db.query(
      `SELECT id, franqueado_id, empresa_id FROM pesquisas_satisfacao_franqueados 
       WHERE token = ? AND status = 'enviado'
       LIMIT 1`,
      [token]
    );
    
    if (!pesquisa) {
      return res.status(404).json({ error: 'Pesquisa não encontrada ou já respondida.' });
    }
    
    // Classificação NPS baseada na nota geral
    let nps_classificacao = 'sem_resposta';
    if (notaSatisfacaoGeral >= 7) nps_classificacao = 'sala_verde'; // Sala verde a partir de nota 7
    else if (notaSatisfacaoGeral === 5 || notaSatisfacaoGeral === 6) nps_classificacao = 'sala_amarela'; // Sala amarela: notas 5 e 6
    else if (notaSatisfacaoGeral >= 0 && notaSatisfacaoGeral <= 4) nps_classificacao = 'sala_vermelha'; // Sala vermelha: notas 0 a 4
    
    // Atualizar a pesquisa com todas as respostas
    await db.query(`
      UPDATE pesquisas_satisfacao_franqueados
      SET 
        status = 'respondido',
        data_resposta = NOW(),
        nota_satisfacao_geral = ?,
        comentario_geral = ?,
        nota_atendimento = ?,
        nota_ti = ?,
        nota_parceiros = ?,
        comentario_atendimento = ?,
        comentario_ti = ?,
        comentario_parceiros = ?,
        utiliza_backoffice_pessoal = ?,
        utiliza_backoffice_fiscal = ?,
        utiliza_backoffice_contabil = ?,
        nao_utiliza_backoffice = ?,
        nota_dep_pessoal = ?,
        nota_demandas_pessoal = ?,
        comentario_pessoal = ?,
        nota_dep_fiscal = ?,
        nota_demandas_fiscal = ?,
        comentario_fiscal = ?,
        nota_dep_contabil = ?,
        nota_demandas_contabil = ?,
        comentario_contabil = ?,
        nps_classificacao = ?,
        atualizado_em = NOW()
      WHERE id = ?
    `, [
      notaSatisfacaoGeral,
      comentarioGeral || null,
      notaAtendimento || null,
      notaTi || null,
      notaParceiros || null,
      comentarioAtendimento || null,
      comentarioTi || null,
      comentarioParceiros || null,
      utilizaBackofficePessoal || false,
      utilizaBackofficeFiscal || false,
      utilizaBackofficeContabil || false,
      naoUtilizaBackoffice || false,
      notaDepPessoal || null,
      notaDemandasPessoal || null,
      comentarioPessoal || null,
      notaDepFiscal || null,
      notaDemandasFiscal || null,
      comentarioFiscal || null,
      notaDepContabil || null,
      notaDemandasContabil || null,
      comentarioContabil || null,
      nps_classificacao,
      pesquisa.id
    ]);
    
    // Buscar informações da empresa para o webhook
    const [[empresa]] = await db.query(
      'SELECT razaoSocial, logo_url FROM empresas WHERE id = ?',
      [pesquisa.empresa_id]
    );
    
    // Buscar informações do franqueado
    const [[franqueado]] = await db.query(
      'SELECT nome, telefone_principal, email FROM franqueados WHERE id = ?',
      [pesquisa.franqueado_id]
    );
    
    // Enviar webhook para o n8n
    try {
      const payload = {
        nome: franqueado.nome,
        telefone: franqueado.telefone_principal,
        email: franqueado.email,
        notaSatisfacaoGeral: notaSatisfacaoGeral,
        comentarioGeral: comentarioGeral,
        satisfacaoServicos: {
          atendimento: notaAtendimento,
          ti: notaTi,
          parceiros: notaParceiros
        },
        comentariosServicos: {
          atendimento: comentarioAtendimento,
          ti: comentarioTi,
          parceiros: comentarioParceiros
        },
        utilizaBackoffice: {
          pessoal: utilizaBackofficePessoal,
          fiscal: utilizaBackofficeFiscal,
          contabil: utilizaBackofficeContabil,
          naoUtiliza: naoUtilizaBackoffice
        },
        notasDepartamentos: {
          pessoal: notaDepPessoal,
          demandasPessoal: notaDemandasPessoal,
          fiscal: notaDepFiscal,
          demandasFiscal: notaDemandasFiscal,
          contabil: notaDepContabil,
          demandasContabil: notaDemandasContabil
        },
        comentariosDepartamentos: {
          pessoal: comentarioPessoal,
          fiscal: comentarioFiscal,
          contabil: comentarioContabil
        },
        nps_classificacao: nps_classificacao,
        empresa: empresa.razaoSocial,
        logo_url: empresa.logo_url,
        tipo: 'franqueado_resposta',
        dataResposta: new Date().toISOString()
      };
      
      await axios.post('https://auto-n8n-omega.k6fcpj.easypanel.host/webhook-test/d5925ced-7664-4438-9031-dff407f7777a', payload);
    } catch (err) {
      console.error('Erro ao enviar webhook para o n8n:', err.message);
    }
    
    res.json({ 
      success: true, 
      message: 'Resposta registrada com sucesso!',
      nps_classificacao 
    });
    
  } catch (err) {
    console.error('Erro ao registrar resposta da pesquisa de franqueado:', err);
    res.status(500).json({ error: 'Erro ao registrar resposta.' });
  }
});

// Rota para buscar estatísticas das pesquisas de franqueados
router.get('/franqueado/estatisticas/:empresaId', autenticarToken, async (req, res) => {
  const { empresaId } = req.params;
  
  try {
    // Verificar se o usuário tem permissão para a empresa
    if (req.usuario.empresaId !== parseInt(empresaId) && req.usuario.tipo !== 'admin') {
      return res.status(403).json({ error: 'Acesso negado.' });
    }

    // Buscar todas as pesquisas respondidas da empresa
    const [pesquisas] = await db.query(`
      SELECT 
        nota_satisfacao_geral,
        nota_atendimento,
        nota_ti,
        nota_parceiros,
        nota_dep_pessoal,
        nota_demandas_pessoal,
        nota_dep_fiscal,
        nota_demandas_fiscal,
        nota_dep_contabil,
        nota_demandas_contabil
      FROM pesquisas_satisfacao_franqueados 
      WHERE empresa_id = ? AND status = 'respondido'
    `, [empresaId]);

    if (pesquisas.length === 0) {
      return res.json({
        total_respostas: 0,
        medias: {
          franquia: 0,
          dp: 0,
          fiscal: 0,
          contabil: 0
        }
      });
    }

    // Calcular médias
    let totalFranquia = 0;
    let totalDP = 0;
    let totalFiscal = 0;
    let totalContabil = 0;
    let countFranquia = 0;
    let countDP = 0;
    let countFiscal = 0;
    let countContabil = 0;

    pesquisas.forEach(pesquisa => {
      // Média da Franquia (atendimento + TI + parceiros + satisfação geral)
      if (pesquisa.nota_atendimento !== null) {
        totalFranquia += pesquisa.nota_atendimento;
        countFranquia++;
      }
      if (pesquisa.nota_ti !== null) {
        totalFranquia += pesquisa.nota_ti;
        countFranquia++;
      }
      if (pesquisa.nota_parceiros !== null) {
        totalFranquia += pesquisa.nota_parceiros;
        countFranquia++;
      }
      if (pesquisa.nota_satisfacao_geral !== null) {
        totalFranquia += pesquisa.nota_satisfacao_geral;
        countFranquia++;
      }

      // Média DP
      if (pesquisa.nota_dep_pessoal !== null) {
        totalDP += pesquisa.nota_dep_pessoal;
        countDP++;
      }
      if (pesquisa.nota_demandas_pessoal !== null) {
        totalDP += pesquisa.nota_demandas_pessoal;
        countDP++;
      }

      // Média Fiscal
      if (pesquisa.nota_dep_fiscal !== null) {
        totalFiscal += pesquisa.nota_dep_fiscal;
        countFiscal++;
      }
      if (pesquisa.nota_demandas_fiscal !== null) {
        totalFiscal += pesquisa.nota_demandas_fiscal;
        countFiscal++;
      }

      // Média Contábil
      if (pesquisa.nota_dep_contabil !== null) {
        totalContabil += pesquisa.nota_dep_contabil;
        countContabil++;
      }
      if (pesquisa.nota_demandas_contabil !== null) {
        totalContabil += pesquisa.nota_demandas_contabil;
        countContabil++;
      }
    });

    const medias = {
      franquia: countFranquia > 0 ? Math.round((totalFranquia / countFranquia) * 10) / 10 : 0,
      dp: countDP > 0 ? Math.round((totalDP / countDP) * 10) / 10 : 0,
      fiscal: countFiscal > 0 ? Math.round((totalFiscal / countFiscal) * 10) / 10 : 0,
      contabil: countContabil > 0 ? Math.round((totalContabil / countContabil) * 10) / 10 : 0
    };

    res.json({
      total_respostas: pesquisas.length,
      medias
    });

  } catch (error) {
    console.error('Erro ao buscar estatísticas:', error);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
});

// Rota para verificar se a empresa é franqueadora e buscar estatísticas das pesquisas de franqueados
router.get('/franqueadora/estatisticas/:empresaId', autenticarToken, async (req, res) => {
  const { empresaId } = req.params;
  
  try {
    // Verificar se o usuário tem permissão para a empresa
    if (req.usuario.empresaId !== parseInt(empresaId) && req.usuario.tipo !== 'admin') {
      return res.status(403).json({ error: 'Acesso negado.' });
    }

    // Verificar se a empresa é franqueadora
    const [[empresa]] = await db.query(
      'SELECT tipo_empresa FROM empresas WHERE id = ?',
      [empresaId]
    );

    if (!empresa || empresa.tipo_empresa !== 'franqueadora') {
      return res.json({
        isFranqueadora: false,
        message: 'Empresa não é franqueadora'
      });
    }

    // Buscar todas as pesquisas respondidas da empresa
    const [pesquisas] = await db.query(`
      SELECT 
        nota_satisfacao_geral,
        nps_classificacao,
        nota_dep_fiscal,
        nota_dep_pessoal,
        nota_dep_contabil
      FROM pesquisas_satisfacao_franqueados 
      WHERE empresa_id = ? AND status = 'respondido'
    `, [empresaId]);

    // Buscar total de envios
    const [[totalEnvios]] = await db.query(`
      SELECT COUNT(*) as total
      FROM pesquisas_satisfacao_franqueados 
      WHERE empresa_id = ? AND status = 'enviado'
    `, [empresaId]);

    if (pesquisas.length === 0) {
      return res.json({
        isFranqueadora: true,
        total_respostas: 0,
        total_envios: totalEnvios.total,
        salas: {
          verde: 0,
          amarela: 0,
          vermelha: 0
        },
        taxa_satisfacao: 0,
        notas_medias: { fiscal: 0, dp: 0, contabil: 0 }
      });
    }

    // Calcular estatísticas das salas (incluindo novas classificações NPS)
    const salas = {
      verde: pesquisas.filter(p => p.nps_classificacao === 'sala_verde' || p.nps_classificacao === 'promotor').length,
      amarela: pesquisas.filter(p => p.nps_classificacao === 'sala_amarela' || p.nps_classificacao === 'passivo' || p.nps_classificacao === 'neutro').length,
      vermelha: pesquisas.filter(p => p.nps_classificacao === 'sala_vermelha' || p.nps_classificacao === 'detrator').length
    };

    // Calcular taxa de satisfação (sala verde + amarela / total)
    const totalSatisfeitos = salas.verde + salas.amarela;
    const taxaSatisfacao = Math.round((totalSatisfeitos / pesquisas.length) * 100);

    // Calcular médias das notas por departamento
    const notasFiscais = pesquisas.filter(p => p.nota_dep_fiscal !== null).map(p => p.nota_dep_fiscal);
    const notasPessoal = pesquisas.filter(p => p.nota_dep_pessoal !== null).map(p => p.nota_dep_pessoal);
    const notasContabeis = pesquisas.filter(p => p.nota_dep_contabil !== null).map(p => p.nota_dep_contabil);

    const mediaFiscal = notasFiscais.length > 0 ? Math.round((notasFiscais.reduce((a, b) => a + b, 0) / notasFiscais.length) * 10) / 10 : 0;
    const mediaPessoal = notasPessoal.length > 0 ? Math.round((notasPessoal.reduce((a, b) => a + b, 0) / notasPessoal.length) * 10) / 10 : 0;
    const mediaContabil = notasContabeis.length > 0 ? Math.round((notasContabeis.reduce((a, b) => a + b, 0) / notasContabeis.length) * 10) / 10 : 0;

    res.json({
      isFranqueadora: true,
      total_respostas: pesquisas.length,
      total_envios: totalEnvios.total,
      salas,
      taxa_satisfacao: taxaSatisfacao,
      notas_medias: {
        fiscal: mediaFiscal,
        pessoal: mediaPessoal,
        contabil: mediaContabil
      }
    });

  } catch (error) {
    console.error('Erro ao buscar estatísticas da franqueadora:', error);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
});

// Rota para buscar dados detalhados das pesquisas de franqueados
router.get('/franqueadora/detalhado/:empresaId', autenticarToken, async (req, res) => {
  const { empresaId } = req.params;
  
  try {
    // Verificar se o usuário tem permissão para a empresa
    if (req.usuario.empresaId !== parseInt(empresaId) && req.usuario.tipo !== 'admin') {
      return res.status(403).json({ error: 'Acesso negado.' });
    }

    // Verificar se a empresa é franqueadora
    const [[empresa]] = await db.query(
      'SELECT tipo_empresa FROM empresas WHERE id = ?',
      [empresaId]
    );

    if (!empresa || empresa.tipo_empresa !== 'franqueadora') {
      return res.status(403).json({ error: 'Apenas empresas franqueadoras podem acessar estes dados.' });
    }

    // Buscar pesquisas detalhadas com informações do franqueado
    const [pesquisas] = await db.query(`
      SELECT 
        psf.id,
        psf.franqueado_id,
        psf.nota_satisfacao_geral,
        psf.nps_classificacao,
        psf.data_resposta,
        psf.comentario_geral,
        psf.nota_atendimento,
        psf.comentario_atendimento,
        psf.nota_ti,
        psf.comentario_ti,
        psf.nota_parceiros,
        psf.comentario_parceiros,
        psf.nota_dep_fiscal,
        psf.comentario_fiscal,
        psf.nota_dep_pessoal,
        psf.comentario_pessoal,
        psf.nota_dep_contabil,
        psf.comentario_contabil,
        psf.nota_demandas_fiscal,
        psf.nota_demandas_pessoal,
        psf.nota_demandas_contabil,
        psf.utiliza_backoffice_pessoal,
        psf.utiliza_backoffice_fiscal,
        psf.utiliza_backoffice_contabil,
        psf.nao_utiliza_backoffice,
        f.nome as franqueado_nome,
        f.unidade
      FROM pesquisas_satisfacao_franqueados psf
      JOIN franqueados f ON psf.franqueado_id = f.id
      WHERE psf.empresa_id = ? AND psf.status = 'respondido'
      ORDER BY psf.data_resposta DESC
    `, [empresaId]);

    res.json({
      success: true,
      pesquisas: pesquisas || []
    });

  } catch (error) {
    console.error('Erro ao buscar dados detalhados:', error);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
});

// Rota para buscar histórico de pesquisas de um franqueado específico
router.get('/franqueado/:franqueadoId/historico', autenticarToken, async (req, res) => {
  const { franqueadoId } = req.params;
  const empresaId = req.usuario?.empresaId;
  
  if (!empresaId) {
    return res.status(400).json({ error: 'Empresa não informada' });
  }

  try {
    // Verificar se a empresa é franqueadora
    const [[empresa]] = await db.query(
      'SELECT tipo_empresa FROM empresas WHERE id = ?',
      [empresaId]
    );

    if (!empresa || empresa.tipo_empresa !== 'franqueadora') {
      return res.status(403).json({ error: 'Apenas empresas franqueadoras podem acessar estes dados.' });
    }

    // Verificar se o franqueado pertence à empresa
    const [[franqueado]] = await db.query(
      'SELECT id FROM franqueados WHERE id = ? AND franqueadora_id = ?',
      [franqueadoId, empresaId]
    );

    if (!franqueado) {
      return res.status(404).json({ error: 'Franqueado não encontrado' });
    }

    // Buscar histórico de pesquisas do franqueado
    const [pesquisas] = await db.query(`
      SELECT 
        id,
        nota_satisfacao_geral,
        nps_classificacao,
        data_resposta,
        comentario_geral,
        nota_atendimento,
        nota_ti,
        nota_parceiros,
        nota_dep_fiscal,
        nota_dep_pessoal,
        nota_dep_contabil
      FROM pesquisas_satisfacao_franqueados 
      WHERE franqueado_id = ? AND empresa_id = ? AND status = 'respondido'
      ORDER BY data_resposta DESC
    `, [franqueadoId, empresaId]);

    res.json({
      success: true,
      pesquisas: pesquisas || []
    });

  } catch (error) {
    console.error('Erro ao buscar histórico do franqueado:', error);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
});

// Rota para buscar franqueados sem resposta
router.get('/franqueadora/sem-resposta/:empresaId', autenticarToken, async (req, res) => {
  const { empresaId } = req.params;
  
  try {
    // Verificar se o usuário tem permissão para a empresa
    if (req.usuario.empresaId !== parseInt(empresaId) && req.usuario.tipo !== 'admin') {
      return res.status(403).json({ error: 'Acesso negado.' });
    }

    // Verificar se a empresa é franqueadora
    const [[empresa]] = await db.query(
      'SELECT tipo_empresa FROM empresas WHERE id = ?',
      [empresaId]
    );

    if (!empresa || empresa.tipo_empresa !== 'franqueadora') {
      return res.status(403).json({ error: 'Apenas empresas franqueadoras podem acessar estes dados.' });
    }

    // Buscar franqueados que receberam pesquisa mas não responderam
    const [franqueadosSemResposta] = await db.query(`
      SELECT 
        f.id,
        f.nome,
        f.unidade,
        psf.data_envio
      FROM franqueados f
      INNER JOIN pesquisas_satisfacao_franqueados psf ON f.id = psf.franqueado_id
      WHERE f.franqueadora_id = ? 
        AND psf.empresa_id = ?
        AND psf.data_resposta IS NULL
        AND psf.status = 'enviado'
      ORDER BY psf.data_envio DESC
    `, [empresaId, empresaId]);

    res.json({ franqueados: franqueadosSemResposta });
  } catch (error) {
    console.error('Erro ao buscar franqueados sem resposta:', error);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
});

// Rota para reenviar pesquisas para franqueados sem resposta
router.post('/reenviar-pesquisas-franqueados', autenticarToken, async (req, res) => {
  try {
    const { empresaId, franqueadoIds, reenviarTodos = false } = req.body;
    
    if (!empresaId) {
      return res.status(400).json({ error: 'empresaId é obrigatório' });
    }

    // Verificar se a empresa é franqueadora
    const [[empresa]] = await db.query(
      'SELECT tipo_empresa, razaoSocial, logo_url FROM empresas WHERE id = ?',
      [empresaId]
    );
    
    if (!empresa || empresa.tipo_empresa !== 'franqueadora') {
      return res.status(403).json({ error: 'Empresa não é franqueadora ou não encontrada.' });
    }

    // Verificar se a empresa optou por pesquisa de satisfação
    const [empresaPesquisa] = await db.query('SELECT pesquisaSatisfacaoAtiva FROM empresas WHERE id = ?', [empresaId]);
    if (!empresaPesquisa.length || empresaPesquisa[0].pesquisaSatisfacaoAtiva !== 1) {
      return res.status(403).json({ error: 'Empresa não optou por pesquisa de satisfação.' });
    }

    let franqueadosParaReenviar = [];

    if (reenviarTodos) {
      // Buscar todos os franqueados sem resposta
      const [franqueados] = await db.query(`
        SELECT 
          f.id,
          f.nome,
          f.unidade,
          f.telefone_principal,
          f.email,
          psf.id as pesquisa_id
        FROM franqueados f
        INNER JOIN pesquisas_satisfacao_franqueados psf ON f.id = psf.franqueado_id
        WHERE f.franqueadora_id = ? 
          AND psf.empresa_id = ?
          AND psf.data_resposta IS NULL
          AND psf.status = 'enviado'
        ORDER BY psf.data_envio DESC
      `, [empresaId, empresaId]);
      
      franqueadosParaReenviar = franqueados;
    } else if (franqueadoIds && franqueadoIds.length > 0) {
      // Buscar franqueados específicos
      const placeholders = franqueadoIds.map(() => '?').join(',');
      const [franqueados] = await db.query(`
        SELECT 
          f.id,
          f.nome,
          f.unidade,
          f.telefone_principal,
          f.email,
          psf.id as pesquisa_id
        FROM franqueados f
        INNER JOIN pesquisas_satisfacao_franqueados psf ON f.id = psf.franqueado_id
        WHERE f.franqueadora_id = ? 
          AND psf.empresa_id = ?
          AND f.id IN (${placeholders})
          AND psf.data_resposta IS NULL
          AND psf.status = 'enviado'
      `, [empresaId, empresaId, ...franqueadoIds]);
      
      franqueadosParaReenviar = franqueados;
    } else {
      return res.status(400).json({ error: 'Selecione franqueados ou marque "reenviar todos".' });
    }

    if (franqueadosParaReenviar.length === 0) {
      return res.status(404).json({ error: 'Nenhum franqueado sem resposta encontrado.' });
    }

    const pesquisasReenviadas = [];
    const now = new Date();

    // Mensagem WhatsApp para franqueados
    const mensagemWhatsappBase = `Olá! 👋\n\n${empresa.razaoSocial} valoriza muito a sua opinião como franqueado!\n\nPor favor, dedique 1 minutinho para responder nossa pesquisa de satisfação e nos ajude a evoluir ainda mais nossos serviços.\n\nSua resposta faz toda a diferença para nós!\n\nEquipe ${empresa.razaoSocial}`;

    for (const franqueado of franqueadosParaReenviar) {
      // Gerar novo token para reenvio
      const novoToken = crypto.randomBytes(24).toString('hex');
      const linkPesquisa = `https://app.cftitan.com.br/public/pesquisa-franqueado/${novoToken}`;

      // Atualizar pesquisa existente com novo token
      await db.query(`
        UPDATE pesquisas_satisfacao_franqueados 
        SET token = ?, data_envio = ?, atualizado_em = ?
        WHERE id = ?
      `, [novoToken, now, now, franqueado.pesquisa_id]);

      // Criar mensagem WhatsApp específica com o link
      const mensagemWhatsapp = `${mensagemWhatsappBase}\n\n🔗 Link da pesquisa: ${linkPesquisa}`;

      // Preparar payload para webhook
      const payload = {
        nome: franqueado.nome,
        unidade: franqueado.unidade,
        telefone: franqueado.telefone_principal,
        email: franqueado.email,
        link: linkPesquisa,
        empresa: empresa.razaoSocial,
        logo_url: empresa.logo_url,
        mensagem: mensagemWhatsapp,
        tipo: 'reenvio'
      };

      // Envio via e-mail
      if (franqueado.email) {
        try {
          const transporter = nodemailer.createTransporter({
            host: process.env.EMAIL_HOST,
            port: parseInt(process.env.EMAIL_PORT),
            secure: parseInt(process.env.EMAIL_PORT) === 465,
            auth: {
              user: process.env.EMAIL_USER,
              pass: process.env.EMAIL_PASS,
            },
          });

          const mailOptions = {
            from: `"${empresa.razaoSocial}" <${process.env.EMAIL_USER}>`,
            to: franqueado.email,
            subject: `Lembrete: Pesquisa de Satisfação - ${empresa.razaoSocial}`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center; border-radius: 10px 10px 0 0;">
                  ${empresa.logo_url ? `<img src="${empresa.logo_url}" alt="${empresa.razaoSocial}" style="max-height: 60px; margin-bottom: 20px;">` : ''}
                  <h1 style="color: #ffffff; margin: 0; font-size: 1.8rem;">Lembrete: Pesquisa de Satisfação</h1>
                  <p style="color: #e0e7ff; margin: 10px 0 0 0; font-size: 1.1rem;">Sua opinião é muito importante para nós!</p>
                </div>
                <div style="padding: 40px 30px; background: #ffffff; border-radius: 0 0 10px 10px; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
                  <h2 style="color: #1f2937; margin: 0 0 20px 0; font-size: 1.4rem;">Olá, ${franqueado.nome}!</h2>
                  <p style="color: #4b5563; line-height: 1.6; margin: 0 0 25px 0; font-size: 1rem;">
                    A <strong>${empresa.razaoSocial}</strong> valoriza muito a sua opinião como franqueado!
                  </p>
                  <p style="color: #4b5563; line-height: 1.6; margin: 0 0 30px 0; font-size: 1rem;">
                    Por favor, dedique apenas 1 minutinho para responder nossa pesquisa de satisfação e nos ajude a evoluir ainda mais nossos serviços.
                  </p>
                  <div style="text-align: center; margin: 35px 0;">
                    <a href="${linkPesquisa}" style="background: linear-gradient(90deg, #2563eb 60%, #60a5fa 100%); color: #fff; text-decoration: none; padding: 16px 38px; border-radius: 10px; font-size: 1.18rem; font-weight: bold; display: inline-block; box-shadow: 0 2px 8px #e0e7ef;">
                      Quero dar minha opinião
                    </a>
                  </div>
                  <p style="font-size: 0.98rem; color: #64748b; text-align: center;">
                    Se preferir, copie e cole este link no navegador:<br>
                    <span style="word-break: break-all; color: #2563eb;">${linkPesquisa}</span>
                  </p>
                  <p style="font-size: 1rem; color: #334155; margin-top: 32px; text-align: center;">
                    Sua resposta faz toda a diferença para nós.<br>
                    <b>Equipe ${empresa.razaoSocial}</b>
                  </p>
                </div>
              </div>
            `
          };
          
          await transporter.sendMail(mailOptions);
        } catch (err) {
          console.error('Erro ao reenviar e-mail de pesquisa para franqueado:', err.message);
        }
      }

      // Envio via WhatsApp (z-api) com delay
      if (franqueado.telefone_principal) {
        const numero = franqueado.telefone_principal.replace(/\D/g, "");
        console.log(`Reenviando WhatsApp para ${franqueado.nome} - Número: ${numero}`);
        
        // Delay de 10-15 segundos entre mensagens para evitar spam/ban
        const delay = 10000 + Math.random() * 5000; // 10-15 segundos
        console.log(`Aguardando ${Math.round(delay/1000)}s antes de reenviar para ${franqueado.nome}...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        
        fetch("https://api.z-api.io/instances/3E49EC6B1CCDE0D5F124026A127A4111/token/A1A276E2FA5A377E1673631F/send-text", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Client-Token": "Fa1b5d1944e5248848a63467268e3fdccS"
          },
          body: JSON.stringify({
            phone: numero,
            message: mensagemWhatsapp
          })
        }).then(response => {
          console.log(`WhatsApp reenviado para ${franqueado.nome}:`, response.status);
          return response.json();
        }).then(data => {
          console.log(`Resposta Z-API para ${franqueado.nome} (reenvio):`, data);
        }).catch(error => {
          console.error(`Erro ao reenviar WhatsApp para ${franqueado.nome}:`, error);
        });
      } else {
        console.log(`Franqueado ${franqueado.nome} não tem telefone principal para reenvio`);
      }

      // Envio do webhook para o n8n
      try {
        await axios.post('https://auto-n8n-omega.k6fcpj.easypanel.host/webhook-test/d5925ced-7664-4438-9031-dff407f7777a', payload);
      } catch (err) {
        console.error('Erro ao enviar webhook para o n8n:', err.message);
      }

      pesquisasReenviadas.push({
        id: franqueado.id,
        nome: franqueado.nome,
        unidade: franqueado.unidade,
        novoToken
      });
    }

    res.json({ 
      success: true, 
      message: `${pesquisasReenviadas.length} pesquisas reenviadas com sucesso`,
      estatisticas: {
        totalReenviadas: pesquisasReenviadas.length,
        totalFranqueados: franqueadosParaReenviar.length
      },
      pesquisasReenviadas
    });

  } catch (err) {
    console.error('Erro ao reenviar pesquisas para franqueados:', err);
    res.status(500).json({ error: 'Erro ao reenviar pesquisas para franqueados.' });
  }
});

module.exports = router; 
