const express = require('express');
const router = express.Router();
const db = require('../../config/database'); // Conexão com banco de dados
const verifyToken = require('../../middlewares/auth');

router.get("/projecao", async (req, res) => {
  const { funil_id, granularidade = "mes", ano } = req.query;
  if (!funil_id) return res.status(400).json({ error: "Funil obrigatório" });

  let groupBy, dateSelect;
  if (granularidade === "dia") {
    groupBy = "DATE(criado_em), funil_fase_id";
    dateSelect = "DATE(criado_em) as periodo, funil_fase_id";
  } else if (granularidade === "semana") {
    groupBy = "YEAR(criado_em), WEEK(criado_em), funil_fase_id";
    dateSelect = "YEAR(criado_em) as ano, WEEK(criado_em) as semana, funil_fase_id";
  } else if (granularidade === "ano") {
    groupBy = "YEAR(criado_em), funil_fase_id";
    dateSelect = "YEAR(criado_em) as periodo, funil_fase_id";
  } else {
    // padrão MES
    groupBy = "YEAR(criado_em), MONTH(criado_em), funil_fase_id";
    dateSelect = "YEAR(criado_em) as ano, MONTH(criado_em) as mes, funil_fase_id";
  }

  let where = "funil_id = ?";
  let params = [funil_id];
  if (ano && granularidade !== "ano") {
    where += " AND YEAR(criado_em) = ?";
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
  const { empresa_id } = req.query;
  if (!empresa_id ) {
    return res.status(400).json({ error: "Parâmetros obrigatórios: empresa_id, inicio, fim" });
  }
  try {
    const [rows] = await db.query(`
      SELECT 
        l.usuario_id, 
        u.nome AS responsavel_nome,
        u.avatar_url,
        SUM(l.status = 'ganhou') AS ganhos,
        SUM(l.status = 'aberto') AS abertos,
        SUM(l.status = 'perdeu') AS perdidos,
        COUNT(*) AS total
      FROM leads l
      JOIN usuarios u ON u.id = l.usuario_id
      WHERE l.empresa_id = ?
      GROUP BY l.usuario_id, u.nome, u.avatar_url
      ORDER BY ganhos DESC, total DESC
    `, [empresa_id]);
    
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
    // Passo 1: Buscar o lead (agora já traz usuario_id)
    const [leadRows] = await db.query(`
      SELECT 
        leads.id,
        leads.nome,
        leads.email,
        leads.telefone,
        leads.valor,
        leads.data_prevista,
        leads.status,
        leads.temperatura,
        leads.criado_em,
        DATEDIFF(CURDATE(), leads.criado_em) AS dias,
        leads.funil_id, 
        leads.funil_fase_id,
        leads.empresa_id,
        leads.usuario_id,    -- 🔥 Importante trazer!
        funis.nome AS funil_nome,
        funil_fases.nome AS fase_nome
      FROM leads
      LEFT JOIN funis ON leads.funil_id = funis.id
      LEFT JOIN funil_fases ON leads.funil_fase_id = funil_fases.id
      WHERE leads.id = ?
    `, [id]);

    if (leadRows.length === 0) {
      return res.status(404).json({ error: 'Lead não encontrado.' });
    }

    const lead = leadRows[0];

    // Novo: Buscar o usuário vinculado ao lead (usuario_id)
    let responsavel_nome = "Não definido";
    let responsavel_avatar = null;

    if (lead.usuario_id) {
      const [userRows] = await db.query(
        'SELECT nome as full_nome, avatar_url FROM usuarios WHERE id = ?',
        [lead.usuario_id]
      );
      if (userRows.length > 0) {
        responsavel_nome = userRows[0].full_nome;
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
  const { nome, email, telefone, empresa_id, funil_id, funil_fase_id, valor, data_prevista, status, usuario_id } = req.body;

  if (!nome || !empresa_id || !funil_id || !funil_fase_id) {
    return res.status(400).json({ error: 'Campos obrigatórios: nome, usuario_id, empresa_id, funil_id e funil_fase_id.' });
  }

  try {
    const [result] = await db.query(
      `INSERT INTO leads (nome, email, telefone, usuario_id, empresa_id, funil_id, funil_fase_id, valor, data_prevista, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        nome,
        email,
        telefone || '',
        usuario_id,
        empresa_id,
        funil_id,
        funil_fase_id,
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
        leads.nome, 
        leads.email, 
        leads.telefone, 
        leads.valor,
        leads.data_prevista,
        leads.temperatura,
        leads.status,
        leads.criado_em,
        DATEDIFF(CURDATE(), leads.criado_em) AS dias,
        empresas.nome AS equipe_nome,
        funis.nome AS funil_nome,
        funil_fases.nome AS fase_nome,
        leads.funil_fase_id,
        leads.empresa_id,
        leads.usuario_id
      FROM leads
      LEFT JOIN empresas ON leads.empresa_id = empresas.id
      LEFT JOIN funis ON leads.funil_id = funis.id
      LEFT JOIN funil_fases ON leads.funil_fase_id = funil_fases.id
    `;

    const params = [];
    if (funil_id) {
      query += ` WHERE leads.funil_id = ?`;
      params.push(funil_id);
    }

    const [leads] = await db.query(query, params);

    // Para cada lead, buscar o usuário vinculado (usuario_id)
    const leadsComResponsavel = await Promise.all(
      leads.map(async (lead) => {
        let responsavel_nome = "Não definido";
        let responsavel_avatar = null;

        if (lead.usuario_id) {
          const [userRows] = await db.query(
            'SELECT nome, avatar_url FROM usuarios WHERE id = ?',
            [lead.usuario_id]
          );
          if (userRows.length > 0) {
            responsavel_nome = userRows[0].nome;
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
router.get('/empresa/:empresaId', verifyToken, async (req, res) => {
  try {
    const { funil_id } = req.query;
    const { empresaId } = req.params;

    let query = `
      SELECT 
        leads.id, 
        leads.nome, 
        leads.email, 
        leads.telefone, 
        leads.valor,
        leads.data_prevista,
        leads.temperatura,
        leads.status,
        leads.criado_em,
        DATEDIFF(CURDATE(), leads.criado_em) AS dias,
        empresas.nome AS equipe_nome,
        funis.nome AS funil_nome,
        funil_fases.nome AS fase_nome,
        leads.funil_fase_id,
        leads.empresa_id,
        leads.usuario_id
      FROM leads
      LEFT JOIN empresas ON leads.empresa_id = empresas.id
      LEFT JOIN funis ON leads.funil_id = funis.id
      LEFT JOIN funil_fases ON leads.funil_fase_id = funil_fases.id
      WHERE leads.empresa_id = ?
    `;

    const params = [empresaId];

    if (funil_id) {
      query += ` AND leads.funil_id = ?`;
      params.push(funil_id);
    }

    const [leads] = await db.query(query, params);

    // Para cada lead, buscar o usuário vinculado (usuario_id)
    const leadsComResponsavel = await Promise.all(
      leads.map(async (lead) => {
        let responsavel_nome = "Não definido";
        let responsavel_avatar = null;

        if (lead.usuario_id) {
          const [userRows] = await db.query(
            'SELECT nome, avatar_url FROM usuarios WHERE id = ?',
            [lead.usuario_id]
          );
          if (userRows.length > 0) {
            responsavel_nome = userRows[0].nome;
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
  const { nome, email, telefone, empresa_id, funil_id, funil_fase_id, valor, data_prevista, status, usuario_id } = req.body;

  try {
    await db.query(
      `UPDATE leads SET 
        nome = ?, 
        email = ?, 
        telefone = ?, 
        empresa_id = ?, 
        funil_id = ?, 
        funil_fase_id = ?, 
        valor = ?, 
        data_prevista = ?, 
        status = ? ,
        usuario_id = ?
      WHERE id = ?`,
      [
        nome,
        email,
        telefone,
        empresa_id,
        funil_id,
        funil_fase_id,
        valor,
        data_prevista,
        status,
        usuario_id,
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

    if (!lead.nome || !lead.email || !lead.telefone) {
      return res.status(400).json({ error: 'Dados incompletos para conversão de lead.' });
    }

    const [result] = await db.query(
      `INSERT INTO pre_clientes (nome, email, telefone, endereco, cpf_cnpj, lead_id, usuario_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [lead.nome, lead.email, lead.telefone, endereco, cpf_cnpj, lead.id, userId]
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
      'UPDATE leads SET funil_fase_id = ?, status = ? WHERE id = ?',
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
    // 1. Buscar o empresa_id direto da tabela leads
    const [[lead]] = await db.query('SELECT empresa_id FROM leads WHERE id = ?', [lead_id]);
    if (!lead) return res.status(404).json({ error: 'Lead não encontrado' });

    // 2. Buscar categorias da equipe
    const [categorias] = await db.query(
      'SELECT * FROM crm_categorias_personalizadas WHERE empresa_id = ? ORDER BY id DESC',
      [lead.empresa_id]
    );

    const resultado = [];

    for (const categoria of categorias) {
      // 3. Buscar campos da categoria
      const [campos] = await db.query(
        'SELECT * FROM crm_campos_personalizados WHERE categoria_id = ? ORDER BY ordem ASC',
        [categoria.id]
      );

      const camposComValor = [];

      for (const campo of campos) {
        // 4. Buscar valor preenchido (se existir) para o campo
        const [[valorObj]] = await db.query(
          'SELECT id, valor FROM crm_valores_personalizados WHERE lead_id = ? AND campo_id = ?',
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


router.get("/contratos-ganhos/:empresaId", verifyToken, async (req, res) => {
  const empresaId = parseInt(req.params.empresaId, 10);

  try {
    // Buscar leads da equipe com status "ganhou"
    const [leadsGanhou] = await db.query(
      "SELECT id FROM leads WHERE empresa_id = ? AND status = 'ganhou'",
      [empresaId]
    );

    if (leadsGanhou.length === 0) {
      return res.json([]); // Nenhum lead ganho
    }

    const leadIds = leadsGanhou.map(lead => lead.id);

    // Buscar clientes vinculados a esses leads
    const [clientes] = await db.query(
      "SELECT id FROM pre_clientes WHERE lead_id IN (?)",
      [leadIds]
    );

    if (clientes.length === 0) {
      return res.json([]); // Nenhum cliente convertido
    }

    const clientIds = clientes.map(c => c.id);

    // Buscar contratos vinculados a esses clientes
    const [contratos] = await db.query(
      "SELECT * FROM contratos WHERE pre_cliente_id IN (?)",
      [clientIds]
    );

    res.json(contratos);
  } catch (error) {
    console.error("❌ Erro ao buscar contratos ganhos:", error);
    res.status(500).json({ error: "Erro ao buscar contratos ganhos." });
  }
});


// GET /leads/contratos-ganhos/:empresaId/light
router.get("/contratos-ganhos/:empresaId/light", verifyToken, async (req, res) => {
  try {
    const empresaId = parseInt(req.params.empresaId, 10) || 0;
    const userId = req.user.id;

    // (opcional, mas recomendado) valida se o usuário pertence à equipe
    const [v] = await db.query(
      "SELECT 1 FROM usuarios_empresas WHERE usuario_id = ? AND empresa_id = ? LIMIT 1",
      [userId, empresaId]
    );
    if (v.length === 0) {
      return res.status(403).json({ error: "Você não tem acesso a essa equipe." });
    }

    // ÚNICA query: filtra por equipe + leads 'ganhou' e já junta cliente e usuário
    const [contratos] = await db.query(`
      SELECT
        c.id,
        c.modelos_contrato_id,
        c.status,
        c.autentique,
        c.autentique_id,
        u.id        AS created_by_id,
        u.nome AS created_by,          -- nome do responsável
        c.criado_em,
        c.expirado_em,
        c.pre_cliente_id,
        cl.nome     AS client_nome,
        c.comeca_em,
        c.termina_em,
        c.empresa_id,
        c.rejeitado_por,
        c.valor,
        c.valor_recorrente
      FROM contratos c
      INNER JOIN pre_clientes cl ON cl.id = c.pre_cliente_id
      INNER JOIN leads   l  ON l.id = cl.lead_id
      INNER JOIN usuarios   u  ON u.id = c.criado_por
      WHERE l.empresa_id = ? AND l.status = 'ganhou'
      ORDER BY c.criado_em DESC
    `, [empresaId]);

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
//   empresa_id, funil_id, funil_fase_id, usuario_id,
//   leads: [ { nome, email, telefone, valor, data_prevista, status } ]
// }
router.post('/import', verifyToken, async (req, res) => {
  try {
    const { empresa_id, funil_id, funil_fase_id, usuario_id, leads, temperatura_padrao } = req.body;

    if (!empresa_id || !funil_id || !funil_fase_id || !usuario_id) {
      return res.status(400).json({ error: 'Parâmetros obrigatórios: empresa_id, funil_id, funil_fase_id, usuario_id.' });
    }
    if (!Array.isArray(leads) || leads.length === 0) {
      return res.status(400).json({ error: 'Lista de leads inválida.' });
    }

    let inseridos = 0;
    let ignorados = 0;
    const erros = [];

    // Critério simples de duplicidade: mesmo email dentro da mesma equipe
    for (const item of leads) {
      const nome = (item?.nome || '').trim();
      const email = (item?.email || '').trim();
      const telefone = (item?.telefone || '').trim();
      const valor = Number(item?.valor || 0) || 0;
      const data_prevista = item?.data_prevista || null;
      const status = item?.status || 'aberto';
      const temperatura = (item?.temperatura || temperatura_padrao || 'neutro');

      if (!nome) {
        ignorados++;
        erros.push({ item, motivo: 'nome obrigatório' });
        continue;
      }

      try {
        if (email) {
          const [dups] = await db.query(
            'SELECT id FROM leads WHERE email = ? AND empresa_id = ? LIMIT 1',
            [email, empresa_id]
          );
          if (dups.length > 0) {
            ignorados++;
            continue;
          }
        }

        await db.query(
          `INSERT INTO leads (nome, email, telefone, usuario_id, empresa_id, funil_id, funil_fase_id, valor, data_prevista, status, temperatura)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            nome,
            email,
            telefone,
            usuario_id,
            empresa_id,
            funil_id,
            funil_fase_id,
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
