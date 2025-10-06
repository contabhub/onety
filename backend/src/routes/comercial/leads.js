const express = require('express');
const router = express.Router();
const db = require('../config/database'); // Conexão com banco de dados
const verifyToken = require("../middlewares/auth");

router.get("/projecao", async (req, res) => {
  const { funil_id, granularidade = "mes", ano } = req.query;
  if (!funil_id) return res.status(400).json({ error: "Funil obrigatório" });

  let groupBy, dateSelect;
  if (granularidade === "dia") {
    groupBy = "DATE(created_at), fase_funil_id";
    dateSelect = "DATE(created_at) as periodo, fase_funil_id";
  } else if (granularidade === "semana") {
    groupBy = "YEAR(created_at), WEEK(created_at), fase_funil_id";
    dateSelect = "YEAR(created_at) as ano, WEEK(created_at) as semana, fase_funil_id";
  } else if (granularidade === "ano") {
    groupBy = "YEAR(created_at), fase_funil_id";
    dateSelect = "YEAR(created_at) as periodo, fase_funil_id";
  } else {
    // padrão MES
    groupBy = "YEAR(created_at), MONTH(created_at), fase_funil_id";
    dateSelect = "YEAR(created_at) as ano, MONTH(created_at) as mes, fase_funil_id";
  }

  let where = "funil_id = ?";
  let params = [funil_id];
  if (ano && granularidade !== "ano") {
    where += " AND YEAR(created_at) = ?";
    params.push(ano);
  }

  let sql = `
    SELECT ${dateSelect}, COUNT(*) as total
    FROM leads
    WHERE ${where}
    GROUP BY ${groupBy}
    ORDER BY ${groupBy}
  `;

  try {
    const [rows] = await db.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao buscar projeção" });
  }
});



// GET /leads/ranking-vendedores
router.get('/ranking-vendedores', verifyToken, async (req, res) => {
  const { team_id } = req.query;
  if (!team_id ) {
    return res.status(400).json({ error: "Parâmetros obrigatórios: team_id, inicio, fim" });
  }
  try {
    const [rows] = await db.query(`
      SELECT 
        l.user_id, 
        u.full_name AS responsavel_nome,
        u.avatar_url,
        SUM(l.status = 'ganhou') AS ganhos,
        SUM(l.status = 'aberto') AS abertos,
        SUM(l.status = 'perdeu') AS perdidos,
        COUNT(*) AS total
      FROM leads l
      JOIN users u ON u.id = l.user_id
      WHERE l.team_id = ?
      GROUP BY l.user_id, u.full_name, u.avatar_url
      ORDER BY ganhos DESC, total DESC
    `, [team_id]);
    
    res.json(rows);
  } catch (err) {
    console.error('Erro ao buscar ranking de vendedores:', err);
    res.status(500).json({ error: 'Erro interno' });
  }
});





// 🔹 Buscar um lead específico
router.get('/:id', verifyToken, async (req, res) => {
  const { id } = req.params;

  try {
    // Passo 1: Buscar o lead (agora já traz user_id)
    const [leadRows] = await db.query(`
      SELECT 
        leads.id,
        leads.name,
        leads.email,
        leads.telefone,
        leads.valor,
        leads.data_prevista,
        leads.status,
        leads.temperatura,
        leads.created_at,
        DATEDIFF(CURDATE(), leads.created_at) AS dias,
        leads.funil_id, 
        leads.fase_funil_id,
        leads.team_id,
        leads.user_id,    -- 🔥 Importante trazer!
        funis.nome AS funil_nome,
        funil_fases.nome AS fase_nome
      FROM leads
      LEFT JOIN funis ON leads.funil_id = funis.id
      LEFT JOIN funil_fases ON leads.fase_funil_id = funil_fases.id
      WHERE leads.id = ?
    `, [id]);

    if (leadRows.length === 0) {
      return res.status(404).json({ error: 'Lead não encontrado.' });
    }

    const lead = leadRows[0];

    // Novo: Buscar o usuário vinculado ao lead (user_id)
    let responsavel_nome = "Não definido";
    let responsavel_avatar = null;

    if (lead.user_id) {
      const [userRows] = await db.query(
        'SELECT full_name, avatar_url FROM users WHERE id = ?',
        [lead.user_id]
      );
      if (userRows.length > 0) {
        responsavel_nome = userRows[0].full_name;
        responsavel_avatar = userRows[0].avatar_url || null;
      }
    }

    // Monta o objeto final com nome/avatar do responsável correto
    const leadWithResponsavel = { ...lead, responsavel_nome, responsavel_avatar };

    res.json(leadWithResponsavel);

  } catch (error) {
    console.error('Erro ao buscar lead:', error);
    res.status(500).json({ error: 'Erro ao buscar lead.' });
  }
});




// 🔹 1. Criar novo lead
router.post('/', verifyToken, async (req, res) => {
  const { name, email, telefone, team_id, funil_id, fase_funil_id, valor, data_prevista, status, user_id } = req.body;

  if (!name || !team_id || !funil_id || !fase_funil_id) {
    return res.status(400).json({ error: 'Campos obrigatórios: name, user_id, team_id, funil_id e fase_funil_id.' });
  }

  try {
    const [result] = await db.query(
      `INSERT INTO leads (name, email, telefone, user_id, team_id, funil_id, fase_funil_id, valor, data_prevista, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        name,
        email,
        telefone || '',
        user_id,
        team_id,
        funil_id,
        fase_funil_id,
        valor || 0,
        data_prevista || null,
        status || 'aberto'
      ]
    );

    res.status(201).json({ message: 'Lead criado com sucesso.', leadId: result.insertId });
  } catch (error) {
    console.error('Erro ao criar lead:', error.sqlMessage || error.message || error);
    res.status(500).json({ error: error.sqlMessage || error.message || 'Erro ao criar lead.' });

  }
});

// 🔹 2. Listar todos os leads (agora aceita filtro por funil_id)
router.get('/', verifyToken, async (req, res) => {
  try {
    const { funil_id } = req.query;

    let query = `
      SELECT 
        leads.id, 
        leads.name, 
        leads.email, 
        leads.telefone, 
        leads.valor,
        leads.data_prevista,
        leads.temperatura,
        leads.status,
        leads.created_at,
        DATEDIFF(CURDATE(), leads.created_at) AS dias,
        equipes.nome AS equipe_nome,
        funis.nome AS funil_nome,
        funil_fases.nome AS fase_nome,
        leads.fase_funil_id,
        leads.team_id,
        leads.user_id
      FROM leads
      LEFT JOIN equipes ON leads.team_id = equipes.id
      LEFT JOIN funis ON leads.funil_id = funis.id
      LEFT JOIN funil_fases ON leads.fase_funil_id = funil_fases.id
    `;

    const params = [];
    if (funil_id) {
      query += ` WHERE leads.funil_id = ?`;
      params.push(funil_id);
    }

    const [leads] = await db.query(query, params);

    // Para cada lead, buscar o usuário vinculado (user_id)
    const leadsComResponsavel = await Promise.all(
      leads.map(async (lead) => {
        let responsavel_nome = "Não definido";
        let responsavel_avatar = null;

        if (lead.user_id) {
          const [userRows] = await db.query(
            'SELECT full_name, avatar_url FROM users WHERE id = ?',
            [lead.user_id]
          );
          if (userRows.length > 0) {
            responsavel_nome = userRows[0].full_name;
            responsavel_avatar = userRows[0].avatar_url || null;
          }
        }

        return {
          ...lead,
          responsavel_nome,
          responsavel_avatar,
        };
      })
    );

    res.json(leadsComResponsavel);

  } catch (error) {
    console.error('Erro ao buscar leads:', error);
    res.status(500).json({ error: 'Erro ao buscar leads.' });
  }
});


// 🔹 2. Listar todos os leads por equipe
router.get('/equipe/:equipeId', verifyToken, async (req, res) => {
  try {
    const { funil_id } = req.query;
    const { equipeId } = req.params;

    let query = `
      SELECT 
        leads.id, 
        leads.name, 
        leads.email, 
        leads.telefone, 
        leads.valor,
        leads.data_prevista,
        leads.temperatura,
        leads.status,
        leads.created_at,
        DATEDIFF(CURDATE(), leads.created_at) AS dias,
        equipes.nome AS equipe_nome,
        funis.nome AS funil_nome,
        funil_fases.nome AS fase_nome,
        leads.fase_funil_id,
        leads.team_id,
        leads.user_id
      FROM leads
      LEFT JOIN equipes ON leads.team_id = equipes.id
      LEFT JOIN funis ON leads.funil_id = funis.id
      LEFT JOIN funil_fases ON leads.fase_funil_id = funil_fases.id
      WHERE leads.team_id = ?
    `;

    const params = [equipeId];

    if (funil_id) {
      query += ` AND leads.funil_id = ?`;
      params.push(funil_id);
    }

    const [leads] = await db.query(query, params);

    // Para cada lead, buscar o usuário vinculado (user_id)
    const leadsComResponsavel = await Promise.all(
      leads.map(async (lead) => {
        let responsavel_nome = "Não definido";
        let responsavel_avatar = null;

        if (lead.user_id) {
          const [userRows] = await db.query(
            'SELECT full_name, avatar_url FROM users WHERE id = ?',
            [lead.user_id]
          );
          if (userRows.length > 0) {
            responsavel_nome = userRows[0].full_name;
            responsavel_avatar = userRows[0].avatar_url || null;
          }
        }

        return {
          ...lead,
          responsavel_nome,
          responsavel_avatar,
        };
      })
    );

    res.json(leadsComResponsavel);

  } catch (error) {
    console.error('Erro ao buscar leads:', error);
    res.status(500).json({ error: 'Erro ao buscar leads.' });
  }
});



// 🔹 3. Atualizar um lead (todos os dados, inclusive mover de fase)
router.put('/:id', verifyToken, async (req, res) => {
  const { id } = req.params;
  const { name, email, telefone, team_id, funil_id, fase_funil_id, valor, data_prevista, status, user_id } = req.body;

  try {
    await db.query(
      `UPDATE leads SET 
        name = ?, 
        email = ?, 
        telefone = ?, 
        team_id = ?, 
        funil_id = ?, 
        fase_funil_id = ?, 
        valor = ?, 
        data_prevista = ?, 
        status = ? ,
        user_id = ?
      WHERE id = ?`,
      [
        name,
        email,
        telefone,
        team_id,
        funil_id,
        fase_funil_id,
        valor,
        data_prevista,
        status,
        user_id,
        id
      ]
    );

    res.json({ message: 'Lead atualizado com sucesso.' });
  } catch (error) {
    console.error('Erro ao atualizar lead:', error);
    res.status(500).json({ error: 'Erro ao atualizar lead.' });
  }
});

// 🔹 4. Deletar um lead
router.delete('/:id', verifyToken, async (req, res) => {
  const { id } = req.params;

  try {
    await db.query('DELETE FROM leads WHERE id = ?', [id]);
    res.json({ message: 'Lead deletado com sucesso.' });
  } catch (error) {
    console.error('Erro ao deletar lead:', error);
    res.status(500).json({ error: 'Erro ao deletar lead.' });
  }
});

// 🔹 5. Converter lead em cliente (já existente)
router.post('/convert/:leadId', verifyToken, async (req, res) => {
  const leadId = req.params.leadId;
  const { cpf_cnpj, endereco } = req.body;
  const userId = req.user.id; // ID do usuário autenticado

  try {
    const [leads] = await db.query('SELECT * FROM leads WHERE id = ?', [leadId]);
    const lead = leads[0];

    if (!lead) {
      return res.status(404).json({ error: 'Lead não encontrado.' });
    }

    if (!lead.name || !lead.email || !lead.telefone) {
      return res.status(400).json({ error: 'Dados incompletos para conversão de lead.' });
    }

    const [result] = await db.query(
      `INSERT INTO clients (name, email, telefone, endereco, cpf_cnpj, lead_id, user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [lead.name, lead.email, lead.telefone, endereco, cpf_cnpj, lead.id, userId]
    );

    await db.query('UPDATE leads SET status = "ganhou" WHERE id = ?', [leadId]);

    res.status(201).json({ message: 'Lead convertido em cliente.', clientId: result.insertId });
  } catch (error) {
    console.error('Erro ao converter lead em cliente:', error);
    res.status(500).json({ error: 'Erro ao converter lead em cliente.' });
  }
});


// 🔹 Mover lead para outra fase
// 🔹 Mover lead para outra fase e atualizar o status automaticamente
router.put('/:id/mover-fase', verifyToken, async (req, res) => {
  const { id } = req.params;
  const { fase_funil_id } = req.body;

  if (!fase_funil_id) {
    return res.status(400).json({ error: 'O campo fase_funil_id é obrigatório.' });
  }

  try {
    // 🔍 Buscar nome da nova fase
    const [faseRows] = await db.query(
      'SELECT nome FROM funil_fases WHERE id = ?',
      [fase_funil_id]
    );

    if (faseRows.length === 0) {
      return res.status(404).json({ error: 'Fase não encontrada.' });
    }

    const nomeFase = faseRows[0].nome.toLowerCase();

    // 🔍 Buscar status anterior
    const [leadRows] = await db.query(
      'SELECT status FROM leads WHERE id = ?',
      [id]
    );

    if (leadRows.length === 0) {
      return res.status(404).json({ error: 'Lead não encontrado.' });
    }

    const statusAnterior = leadRows[0].status;

    // 📌 Definir novo status com base na nova fase
    let novoStatus = 'aberto';
    if (nomeFase === 'ganhou') novoStatus = 'ganhou';
    else if (nomeFase === 'perdeu') novoStatus = 'perdeu';
    else if (['ganhou', 'perdeu'].includes(statusAnterior)) novoStatus = 'aberto';

    // 📝 Atualizar lead com nova fase e novo status
    await db.query(
      'UPDATE leads SET fase_funil_id = ?, status = ? WHERE id = ?',
      [fase_funil_id, novoStatus, id]
    );

    res.json({ message: `Fase e status do lead atualizados para "${novoStatus}".` });
  } catch (error) {
    console.error('Erro ao mover fase do lead:', error);
    res.status(500).json({ error: 'Erro ao mover fase do lead.' });
  }
});


// GET /leads/:lead_id/dados-personalizados

router.get('/:lead_id/dados-personalizados', async (req, res) => {
  const { lead_id } = req.params;

  try {
    // 1. Buscar o team_id direto da tabela leads
    const [[lead]] = await db.query('SELECT team_id FROM leads WHERE id = ?', [lead_id]);
    if (!lead) return res.status(404).json({ error: 'Lead não encontrado' });

    // 2. Buscar categorias da equipe
    const [categorias] = await db.query(
      'SELECT * FROM categorias_personalizadas WHERE equipe_id = ? ORDER BY id DESC',
      [lead.team_id]
    );

    const resultado = [];

    for (const categoria of categorias) {
      // 3. Buscar campos da categoria
      const [campos] = await db.query(
        'SELECT * FROM campos_personalizados WHERE categoria_id = ? ORDER BY ordem ASC',
        [categoria.id]
      );

      const camposComValor = [];

      for (const campo of campos) {
        // 4. Buscar valor preenchido (se existir) para o campo
        const [[valorObj]] = await db.query(
          'SELECT id, valor FROM valores_personalizados WHERE lead_id = ? AND campo_id = ?',
          [lead_id, campo.id]
        );

        camposComValor.push({
          campo_id: campo.id,
          nome: campo.nome,
          tipo: campo.tipo,
          valor: valorObj?.valor || '',
          valor_id: valorObj?.id || null
        });
      }

      // 5. Organizar categoria com seus campos
      resultado.push({
        categoria_id: categoria.id,
        categoria_nome: categoria.nome,
        campos: camposComValor
      });
    }

    res.json(resultado);
  } catch (error) {
    console.error('Erro ao buscar dados personalizados do lead:', error);
    res.status(500).json({ error: 'Erro interno ao buscar dados do lead' });
  }
});

// 🔍 GET: Buscar a temperatura de um lead
router.get('/:lead_id/temperatura', async (req, res) => {
  const { lead_id } = req.params;

  if (!lead_id) {
    return res.status(400).json({ error: 'lead_id é obrigatório' });
  }

  try {
    const [rows] = await db.query('SELECT temperatura FROM leads WHERE id = ?', [lead_id]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Lead não encontrado' });
    }

    res.json({ temperatura: rows[0].temperatura });
  } catch (error) {
    console.error('Erro ao buscar temperatura do lead:', error);
    res.status(500).json({ error: 'Erro ao buscar temperatura do lead' });
  }
});

// 💾 PUT: Atualizar a temperatura de um lead
router.put('/:lead_id/temperatura', async (req, res) => {
  const { lead_id } = req.params;
  const { temperatura } = req.body; // Temperatura a ser atualizada

  // Verifica se a temperatura foi fornecida
  if (!temperatura) {
    return res.status(400).json({ error: 'O campo temperatura é obrigatório' });
  }

  // Verifica se a temperatura fornecida é válida
  const validTemperaturas = ['frio', 'quente', 'neutro'];
  if (!validTemperaturas.includes(temperatura)) {
    return res.status(400).json({ error: 'Temperatura inválida. Use "frio", "quente" ou "neutro"' });
  }

  try {
    // Atualiza a temperatura do lead
    const result = await db.query(
      'UPDATE leads SET temperatura = ? WHERE id = ?',
      [temperatura, lead_id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Lead não encontrado' });
    }

    res.json({ message: 'Temperatura do lead atualizada com sucesso' });
  } catch (error) {
    console.error('Erro ao atualizar temperatura do lead:', error);
    res.status(500).json({ error: 'Erro ao atualizar temperatura do lead' });
  }
});


router.get("/contratos-ganhos/:equipeId", verifyToken, async (req, res) => {
  const equipeId = parseInt(req.params.equipeId, 10);

  try {
    // Buscar leads da equipe com status "ganhou"
    const [leadsGanhou] = await db.query(
      "SELECT id FROM leads WHERE team_id = ? AND status = 'ganhou'",
      [equipeId]
    );

    if (leadsGanhou.length === 0) {
      return res.json([]); // Nenhum lead ganho
    }

    const leadIds = leadsGanhou.map(lead => lead.id);

    // Buscar clientes vinculados a esses leads
    const [clientes] = await db.query(
      "SELECT id FROM clients WHERE lead_id IN (?)",
      [leadIds]
    );

    if (clientes.length === 0) {
      return res.json([]); // Nenhum cliente convertido
    }

    const clientIds = clientes.map(c => c.id);

    // Buscar contratos vinculados a esses clientes
    const [contratos] = await db.query(
      "SELECT * FROM contracts WHERE client_id IN (?)",
      [clientIds]
    );

    res.json(contratos);
  } catch (error) {
    console.error("❌ Erro ao buscar contratos ganhos:", error);
    res.status(500).json({ error: "Erro ao buscar contratos ganhos." });
  }
});


// GET /contracts/contratos-ganhos/:equipeId/light
router.get("/contratos-ganhos/:equipeId/light", verifyToken, async (req, res) => {
  try {
    const equipeId = parseInt(req.params.equipeId, 10) || 0;
    const userId = req.user.id;

    // (opcional, mas recomendado) valida se o usuário pertence à equipe
    const [v] = await db.query(
      "SELECT 1 FROM user_equipes WHERE user_id = ? AND equipe_id = ? LIMIT 1",
      [userId, equipeId]
    );
    if (v.length === 0) {
      return res.status(403).json({ error: "Você não tem acesso a essa equipe." });
    }

    // ÚNICA query: filtra por equipe + leads 'ganhou' e já junta cliente e usuário
    const [contratos] = await db.query(`
      SELECT
        c.id,
        c.template_id,
        c.status,
        c.autentique,
        c.autentique_id,
        u.id        AS created_by_id,
        u.full_name AS created_by,          -- nome do responsável
        c.created_at,
        c.expires_at,
        c.client_id,
        cl.name     AS client_name,
        c.start_at,
        c.end_at,
        c.equipe_id,
        c.rejected_by,
        c.valor
      FROM contracts c
      INNER JOIN clients cl ON cl.id = c.client_id
      INNER JOIN leads   l  ON l.id = cl.lead_id
      INNER JOIN users   u  ON u.id = c.created_by
      WHERE l.team_id = ? AND l.status = 'ganhou'
      ORDER BY c.created_at DESC
    `, [equipeId]);

    return res.json(contratos);
  } catch (error) {
    console.error("❌ Erro ao buscar contratos ganhos (light):", error);
    return res.status(500).json({ error: "Erro ao buscar contratos ganhos." });
  }
});



// GET /leads/:lead_id/contatos-mensagens
router.get('/:lead_id/contatos-mensagens', verifyToken, async (req, res) => {
  const { lead_id } = req.params;
  try {
    // 1. Buscar todos os contatos do lead
    const [contatos] = await db.query('SELECT * FROM contatos WHERE lead_id = ?', [lead_id]);
    if (!contatos.length) return res.json([]);

    // 2. Para cada contato, buscar TODAS as mensagens (sem LIMIT) e contar
    for (const contato of contatos) {
      const [mensagens] = await db.query(
        'SELECT * FROM mensagens_whatsapp WHERE contato_id = ? ORDER BY hora ASC',
        [contato.id]
      );
      contato.mensagens = mensagens;
      contato.total_mensagens = mensagens.length; // <<<< CONTADOR AQUI
    }

    res.json(contatos);
  } catch (err) {
    console.error('Erro ao buscar contatos + mensagens:', err);
    res.status(500).json({ error: 'Erro interno' });
  }
});




// 🔄 Importação em lote de leads via JSON
// POST /leads/import
// Body esperado:
// {
//   team_id, funil_id, fase_funil_id, user_id,
//   leads: [ { name, email, telefone, valor, data_prevista, status } ]
// }
router.post('/import', verifyToken, async (req, res) => {
  try {
    const { team_id, funil_id, fase_funil_id, user_id, leads, temperatura_padrao } = req.body;

    if (!team_id || !funil_id || !fase_funil_id || !user_id) {
      return res.status(400).json({ error: 'Parâmetros obrigatórios: team_id, funil_id, fase_funil_id, user_id.' });
    }
    if (!Array.isArray(leads) || leads.length === 0) {
      return res.status(400).json({ error: 'Lista de leads inválida.' });
    }

    let inseridos = 0;
    let ignorados = 0;
    const erros = [];

    // Critério simples de duplicidade: mesmo email dentro da mesma equipe
    for (const item of leads) {
      const name = (item?.name || '').trim();
      const email = (item?.email || '').trim();
      const telefone = (item?.telefone || '').trim();
      const valor = Number(item?.valor || 0) || 0;
      const data_prevista = item?.data_prevista || null;
      const status = item?.status || 'aberto';
      const temperatura = (item?.temperatura || temperatura_padrao || 'neutro');

      if (!name) {
        ignorados++;
        erros.push({ item, motivo: 'name obrigatório' });
        continue;
      }

      try {
        if (email) {
          const [dups] = await db.query(
            'SELECT id FROM leads WHERE email = ? AND team_id = ? LIMIT 1',
            [email, team_id]
          );
          if (dups.length > 0) {
            ignorados++;
            continue;
          }
        }

        await db.query(
          `INSERT INTO leads (name, email, telefone, user_id, team_id, funil_id, fase_funil_id, valor, data_prevista, status, temperatura)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            name,
            email,
            telefone,
            user_id,
            team_id,
            funil_id,
            fase_funil_id,
            valor,
            data_prevista,
            status,
            temperatura,
          ]
        );
        inseridos++;
      } catch (err) {
        erros.push({ item, error: err.message || 'Erro ao inserir lead' });
      }
    }

    return res.json({ message: 'Importação concluída', inseridos, ignorados, erros });
  } catch (error) {
    console.error('Erro na importação de leads:', error);
    return res.status(500).json({ error: 'Erro na importação de leads.' });
  }
});


module.exports = router;
