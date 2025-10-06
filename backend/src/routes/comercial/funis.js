const router = require('express').Router();
const db = require('../../config/database');
const verifyToken = require('../../middlewares/auth');

// 🔹 Listar funis de uma equipe
router.get('/:empresaId', verifyToken, async (req, res) => {
  try {
    const { empresaId } = req.params;
    const [rows] = await db.query('SELECT * FROM funis WHERE empresa_id = ?', [empresaId]);
    res.json(rows);
  } catch (error) {
    console.error('Erro ao listar funis:', error);
    res.status(500).json({ error: 'Erro ao listar funis' });
  }
});

// 🔹 Criar novo funil e fases padrão (Proposta ,Ganhou, Perdeu)
router.post('/', verifyToken, async (req, res) => {
  try {
    const { empresa_id, nome, padrao } = req.body;

    if (!empresa_id || !nome) {
      return res.status(400).json({ error: 'empresa_id e nome são obrigatórios.' });
    }

    const [result] = await db.query(
      'INSERT INTO funis (empresa_id, nome, padrao) VALUES (?, ?, ?)',
      [empresa_id, nome, padrao || false]
    );

    const novoFunilId = result.insertId;

    // 🔵 Cria a fase "Proposta"
    await db.query(
      'INSERT INTO funil_fases (funil_id, nome, descricao, ordem) VALUES (?, ?, ?, ?)',
      [novoFunilId, 'Proposta', 'Leads encaminhados para propostas.', 9997]
    );
    // 🔵 Cria a fase "Ganhou"
    await db.query(
      'INSERT INTO funil_fases (funil_id, nome, descricao, ordem) VALUES (?, ?, ?, ?)',
      [novoFunilId, 'Ganhou', 'Leads que fecharam a venda.', 9998]
    );

    // 🔵 Cria a fase "Perdeu"
    await db.query(
      'INSERT INTO funil_fases (funil_id, nome, descricao, ordem) VALUES (?, ?, ?, ?)',
      [novoFunilId, 'Perdeu', 'Leads que não fecharam.', 9999]
    );

    res.status(201).json({ message: 'Funil e fases padrão criados com sucesso.', funilId: novoFunilId });

  } catch (error) {
    console.error('Erro ao criar funil:', error);
    res.status(500).json({ error: 'Erro ao criar funil' });
  }
});


// 🔹 Atualizar funil
router.put('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { nome, padrao } = req.body;

    if (!nome) {
      return res.status(400).json({ error: 'O campo nome é obrigatório.' });
    }

    await db.query('UPDATE funis SET nome = ?, padrao = ? WHERE id = ?', [nome, padrao || false, id]);
    res.json({ message: 'Funil atualizado com sucesso.' });
  } catch (error) {
    console.error('Erro ao atualizar funil:', error);
    res.status(500).json({ error: 'Erro ao atualizar funil' });
  }
});

// 🔹 Deletar funil junto com suas fases
router.delete('/:id', verifyToken, async (req, res) => {
  const { id } = req.params;

  const conn = await db.getConnection(); // se seu driver suportar transações
  try {
    await conn.beginTransaction();

    // Primeiro deleta as fases associadas
    await conn.query('DELETE FROM funil_fases WHERE funil_id = ?', [id]);

    // Depois deleta o próprio funil
    await conn.query('DELETE FROM funis WHERE id = ?', [id]);

    await conn.commit();

    res.json({ message: 'Funil e fases deletados com sucesso.' });
  } catch (error) {
    await conn.rollback();
    console.error('Erro ao deletar funil:', error);
    res.status(500).json({ error: 'Erro ao deletar funil e suas fases' });
  } finally {
    conn.release();
  }
});



router.get('/leads/count/:funilId', verifyToken, async (req, res) => {
  try {
    const { funilId } = req.params;
    
    // Consulta para contar o número de leads por fase de um funil
    const [rows] = await db.query(`
      SELECT fase.id, fase.nome, COUNT(l.id) AS leadsCount
      FROM funil_fases fase
      LEFT JOIN leads l ON l.fase_funil_id = fase.id
      WHERE fase.funil_id = ?
      GROUP BY fase.id
      ORDER BY fase.ordem ASC
    `, [funilId]);

    res.json(rows);
  } catch (error) {
    console.error('Erro ao contar leads por fase:', error);
    res.status(500).json({ error: 'Erro ao contar leads por fase' });
  }
});


// /funis/leads/:leadId/mover
router.patch('/leads/:leadId/mover', verifyToken, async (req, res) => {
  const conn = await db.getConnection();
  try {
    const { leadId } = req.params;
    const { funil_id, fase_id } = req.body;

    if (!funil_id || !fase_id) {
      return res.status(400).json({ error: 'funil_id e fase_id são obrigatórios.' });
    }

    await conn.beginTransaction();

    // 1) Lead existe?
    const [leadRows] = await conn.query(
      'SELECT id, funil_id AS from_funil_id, fase_funil_id AS from_fase_id FROM leads WHERE id = ? LIMIT 1',
      [leadId]
    );
    if (!leadRows.length) {
      await conn.rollback();
      return res.status(404).json({ error: 'Lead não encontrado.' });
    }
    const fromFunilId = leadRows[0].from_funil_id;
    const fromFaseId  = leadRows[0].from_fase_id;

    // 2) Funil existe?
    const [funilRows] = await conn.query(
      'SELECT id FROM funis WHERE id = ? LIMIT 1',
      [funil_id]
    );
    if (!funilRows.length) {
      await conn.rollback();
      return res.status(404).json({ error: 'Funil informado não existe.' });
    }

    // 3) Fase pertence ao funil?
    const [faseRows] = await conn.query(
      'SELECT id FROM funil_fases WHERE id = ? AND funil_id = ? LIMIT 1',
      [fase_id, funil_id]
    );
    if (!faseRows.length) {
      await conn.rollback();
      return res.status(400).json({ error: 'A fase informada não pertence ao funil selecionado.' });
    }

    // 4) Atualiza lead
    await conn.query(
      'UPDATE leads SET funil_id = ?, fase_funil_id = ? WHERE id = ?',
      [funil_id, fase_id, leadId]
    );

    await conn.commit();
    return res.json({
      message: 'Lead movido para o funil/fase selecionados.',
      leadId: Number(leadId),
      from_funil_id: fromFunilId,
      to_funil_id: funil_id,
      from_fase_id: fromFaseId,
      to_fase_id: fase_id
    });
  } catch (e) {
    if (conn) await conn.rollback();
    console.error('Erro ao mover lead:', e);
    return res.status(500).json({ error: 'Erro ao mover lead.' });
  } finally {
    if (conn) conn.release();
  }
});





module.exports = router;
