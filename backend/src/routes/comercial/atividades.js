const express = require('express');
const router = express.Router();
const db = require('../../config/database');
const verifyToken = require('../../middlewares/auth');

// 🔹 Resumo por tipo para uma empresa
router.get('/empresa/:empresaId/por-tipo', verifyToken, async (req, res) => {
  const { empresaId } = req.params;
  try {
    const [rows] = await db.query(`
      SELECT 
        t.id AS tipo_id,
        t.nome AS tipo_nome,
        COUNT(a.id) AS total,
        SUM(CASE WHEN a.status = 'pendente' THEN 1 ELSE 0 END) AS pendente,
        SUM(CASE WHEN a.status = 'concluida' THEN 1 ELSE 0 END) AS concluida
      FROM crm_tipos_atividades t
      LEFT JOIN crm_atividades a ON a.tipo_id = t.id
      WHERE t.empresa_id = ?
      GROUP BY t.id, t.nome
      ORDER BY t.nome ASC
    `, [empresaId]);

    res.json(rows);
  } catch (error) {
    console.error('Erro ao agrupar atividades por tipo:', error);
    res.status(500).json({ error: 'Erro ao agrupar atividades por tipo.' });
  }
});

// 🔹 Criar nova atividade
router.post('/', verifyToken, async (req, res) => {
    const {
      nome,
      observacao,
      data,
      hora,
      duracao,
      tipo_id,
      status,
      lead_id
    } = req.body;
  
    // Validação dos campos obrigatórios
    if (!nome || !tipo_id || !lead_id || !status) {
      return res.status(400).json({
        error: 'Campos obrigatórios: nome, tipo_id, lead_id e status.'
      });
    }
  
    // Validação do status
    if (!['pendente', 'concluida'].includes(status)) {
      return res.status(400).json({
        error: 'Status inválido. Use "pendente" ou "concluida".'
      });
    }
  
    try {
      const [result] = await db.query(`
        INSERT INTO crm_atividades 
        (nome, observacao, data, hora, duracao, tipo_id, status, lead_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [nome, observacao, data, hora, duracao, tipo_id, status, lead_id]
      );
  
      res.status(201).json({
        message: 'Atividade criada com sucesso.',
        atividadeId: result.insertId
      });
    } catch (error) {
      console.error('Erro ao criar atividade:', error);
      res.status(500).json({ error: 'Erro ao criar atividade.' });
    }
  });
  

// 🔹 Listar atividades por lead
router.get('/:leadId', verifyToken, async (req, res) => {
  const { leadId } = req.params;

  try {
    const [rows] = await db.query(`
      SELECT a.*, t.nome AS tipo_nome
      FROM crm_atividades a
      LEFT JOIN crm_tipos_atividades t ON a.tipo_id = t.id
      WHERE a.lead_id = ?
      ORDER BY a.data DESC, a.hora DESC
    `, [leadId]);

    res.json(rows);
  } catch (error) {
    console.error('Erro ao buscar atividades:', error);
    res.status(500).json({ error: 'Erro ao buscar atividades.' });
  }
});

// 🔹 Atualizar atividade
router.put('/:id', verifyToken, async (req, res) => {
  const { id } = req.params;
  const {
    nome,
    observacao,
    data,
    hora,
    duracao,
    tipo_id,
    status
  } = req.body;

  try {
    await db.query(`
      UPDATE crm_atividades SET 
        nome = ?, 
        observacao = ?, 
        data = ?, 
        hora = ?, 
        duracao = ?, 
        tipo_id = ?, 
        status = ?
      WHERE id = ?`,
      [nome, observacao, data, hora, duracao, tipo_id, status, id]
    );

    res.json({ message: 'Atividade atualizada com sucesso.' });
  } catch (error) {
    console.error('Erro ao atualizar atividade:', error);
    res.status(500).json({ error: 'Erro ao atualizar atividade.' });
  }
});

// 🔹 Deletar atividade
router.delete('/:id', verifyToken, async (req, res) => {
  const { id } = req.params;

  try {
    await db.query('DELETE FROM crm_atividades WHERE id = ?', [id]);
    res.json({ message: 'Atividade deletada com sucesso.' });
  } catch (error) {
    console.error('Erro ao deletar atividade:', error);
    res.status(500).json({ error: 'Erro ao deletar atividade.' });
  }
});

// 🔹 Alterar status (opcional)
router.patch('/:id/status', verifyToken, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!['pendente', 'concluida'].includes(status)) {
    return res.status(400).json({ error: 'Status inválido. Use "pendente" ou "concluida".' });
  }

  try {
    await db.query('UPDATE crm_atividades SET status = ? WHERE id = ?', [status, id]);
    res.json({ message: 'Status da atividade atualizado.' });
  } catch (error) {
    console.error('Erro ao atualizar status:', error);
    res.status(500).json({ error: 'Erro ao atualizar status da atividade.' });
  }
});



module.exports = router;
