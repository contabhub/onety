const express = require('express');
const db = require('../../config/database.js');
const verifyToken = require('../../middlewares/auth');

const router = express.Router();

// GET /api/goals - Listar metas globais da empresa (USADO EM: goals.js, organization.js)
router.get('/', verifyToken, async (req, res) => {
  try {
    const { companyId, page = 1, limit = 10, trimestre, ano } = req.query;

    if (!companyId) {
      return res.status(400).json({ error: 'ID da empresa é obrigatório' });
    }

    // Verificar se o usuário tem acesso à empresa
    const [userAccess] = await db.query(
      'SELECT empresa_id FROM usuarios_empresas WHERE usuario_id = ? AND empresa_id = ?',
      [req.user.id, companyId]
    );

    if (!userAccess || userAccess.length === 0) {
      return res.status(403).json({ error: 'Acesso negado a esta empresa' });
    }

    // Construir query base
    let query = 'SELECT * FROM metas_globais WHERE empresa_id = ?';
    const params = [companyId];

    // Aplicar filtros se fornecidos
    if (trimestre) {
      const trimestreNum = parseInt(trimestre);
      let startMonth, endMonth;
      
      if (trimestreNum === 1) { startMonth = 0; endMonth = 2; }
      else if (trimestreNum === 2) { startMonth = 3; endMonth = 5; }
      else if (trimestreNum === 3) { startMonth = 6; endMonth = 8; }
      else if (trimestreNum === 4) { startMonth = 9; endMonth = 11; }

      if (startMonth !== undefined && endMonth !== undefined) {
        const year = ano ? parseInt(ano) : new Date().getFullYear();
        const startDate = `${year}-${String(startMonth + 1).padStart(2, '0')}-01`;
        const endDate = `${year}-${String(endMonth + 1).padStart(2, '0')}-${new Date(year, endMonth + 1, 0).getDate()}`;
        query += ' AND data_inicio >= ? AND data_inicio <= ?';
        params.push(startDate, endDate);
      }
    }

    if (ano) {
      const anoNum = parseInt(ano);
      const startDate = `${anoNum}-01-01`;
      const endDate = `${anoNum}-12-31`;
      query += ' AND data_inicio >= ? AND data_inicio <= ?';
      params.push(startDate, endDate);
    }

    // Se não tem paginação, retornar todos
    if (!page || page === 'undefined' || limit === 'undefined') {
      const [data] = await db.query(query + ' ORDER BY criado_em DESC', params);
      return res.json({
        data: data || [],
        pagination: {
          currentPage: 1,
          totalPages: 1,
          totalCount: data?.length || 0,
          hasNextPage: false,
          hasPrevPage: false,
          limit: data?.length || 0
        }
      });
    }

    // Buscar total de registros para paginação
    const [countRows] = await db.query(
      query.replace('SELECT *', 'SELECT COUNT(*) as total'),
      params
    );
    const totalCount = countRows[0]?.total || 0;

    // Calcular offset para paginação
    const offset = (parseInt(page) - 1) * parseInt(limit);
    query += ' ORDER BY criado_em DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);

    // Buscar dados paginados
    const [data] = await db.query(query, params);

    // Calcular informações de paginação
    const totalPages = Math.ceil(totalCount / parseInt(limit));
    const hasNextPage = parseInt(page) < totalPages;
    const hasPrevPage = parseInt(page) > 1;

    res.json({
      data: data || [],
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalCount,
        hasNextPage,
        hasPrevPage,
        limit: parseInt(limit)
      }
    });

  } catch (error) {
    console.error('Erro ao listar metas globais:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// POST /api/goals - Criar meta global (USADO EM: goals.js)
router.post('/', verifyToken, async (req, res) => {
  try {
    const { companyId, ...goalData } = req.body;

    if (!companyId) {
      return res.status(400).json({ error: 'ID da empresa é obrigatório' });
    }

    // Verificar se o usuário tem acesso à empresa
    const [userAccess] = await db.query(
      'SELECT empresa_id FROM usuarios_empresas WHERE usuario_id = ? AND empresa_id = ?',
      [req.user.id, companyId]
    );

    if (!userAccess || userAccess.length === 0) {
      return res.status(403).json({ error: 'Acesso negado a esta empresa' });
    }

    // Mapear campos do payload para o schema
    const fieldMapping = {
      title: 'titulo',
      description: 'descricao',
      target_value: 'valor_alvo',
      actual_value: 'valor_atual',
      start_date: 'data_inicio',
      end_date: 'data_fim',
      status: 'status',
      calculation_type: 'calculo_tipo',
      indicator_type: 'indicador_tipo',
      progress_type: 'progresso_tipo'
    };

    // Converter campos do payload para campos do schema
    const mappedData = {};
    Object.keys(goalData).forEach(key => {
      const mappedKey = fieldMapping[key] || key;
      mappedData[mappedKey] = goalData[key];
    });

    // Inserir meta global
    const fields = Object.keys(mappedData).join(', ');
    const values = Object.values(mappedData);
    const placeholders = values.map(() => '?').join(', ');
    
    const [result] = await db.query(
      `INSERT INTO metas_globais (empresa_id, ${fields}) VALUES (?, ${placeholders})`,
      [companyId, ...values]
    );

    // Buscar meta criada
    const [data] = await db.query(
      'SELECT * FROM metas_globais WHERE id = ?',
      [result.insertId]
    );

    res.status(201).json(data[0]);

  } catch (error) {
    console.error('Erro ao criar meta global:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// PUT /api/goals/:id - Atualizar meta global (USADO EM: goals.js)
router.put('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Mapear campos do payload para o schema
    const fieldMapping = {
      title: 'titulo',
      description: 'descricao',
      target_value: 'valor_alvo',
      actual_value: 'valor_atual',
      start_date: 'data_inicio',
      end_date: 'data_fim',
      status: 'status',
      calculation_type: 'calculo_tipo',
      indicator_type: 'indicador_tipo',
      progress_type: 'progresso_tipo'
    };

    // Converter campos do payload para campos do schema
    const mappedUpdates = {};
    Object.keys(updates).forEach(key => {
      const mappedKey = fieldMapping[key] || key;
      mappedUpdates[mappedKey] = updates[key];
    });

    // Converter datas ISO para formato MySQL (YYYY-MM-DD)
    const formatDateForMySQL = (dateString) => {
      if (!dateString) return null;
      try {
        const date = new Date(dateString);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      } catch (error) {
        return null;
      }
    };

    // Converter datas se presentes
    if (mappedUpdates.data_inicio) {
      mappedUpdates.data_inicio = formatDateForMySQL(mappedUpdates.data_inicio);
    }
    if (mappedUpdates.data_fim) {
      mappedUpdates.data_fim = formatDateForMySQL(mappedUpdates.data_fim);
    }

    // Remover campos que não devem ser atualizados (como id)
    delete mappedUpdates.id;
    delete mappedUpdates.empresa_id;

    const fields = Object.keys(mappedUpdates).map(key => `${key} = ?`).join(', ');
    const values = Object.values(mappedUpdates);

    await db.query(
      `UPDATE metas_globais SET ${fields} WHERE id = ?`,
      [...values, id]
    );

    // Buscar meta atualizada
    const [data] = await db.query(
      'SELECT * FROM metas_globais WHERE id = ?',
      [id]
    );

    res.json(data[0]);

  } catch (error) {
    console.error('Erro ao atualizar meta global:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// POST /api/goals/:id/monthly-goals - Criar meta mensal para uma meta global (USADO EM: GlobalGoalCard.js)
// IMPORTANTE: Esta rota deve vir ANTES de GET /:id/monthly-goals para evitar conflito
router.post('/:id/monthly-goals', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { companyId, month, value_goal, value_achieved, start_date, end_date } = req.body;

    if (!companyId) {
      return res.status(400).json({ error: 'ID da empresa é obrigatório' });
    }

    // Verificar se o usuário tem acesso à empresa
    const [userAccess] = await db.query(
      'SELECT empresa_id FROM usuarios_empresas WHERE usuario_id = ? AND empresa_id = ?',
      [req.user.id, companyId]
    );

    if (!userAccess || userAccess.length === 0) {
      return res.status(403).json({ error: 'Acesso negado a esta empresa' });
    }

    // Verificar se a meta global existe e pertence à empresa
    const [goal] = await db.query(
      'SELECT * FROM metas_globais WHERE id = ? AND empresa_id = ?',
      [id, companyId]
    );

    if (!goal || goal.length === 0) {
      return res.status(404).json({ error: 'Meta global não encontrada' });
    }

    // Converter nome do mês para número (1-12)
    const monthMap = {
      'Janeiro': 1, 'Fevereiro': 2, 'Março': 3, 'Abril': 4, 'Maio': 5, 'Junho': 6,
      'Julho': 7, 'Agosto': 8, 'Setembro': 9, 'Outubro': 10, 'Novembro': 11, 'Dezembro': 12
    };
    
    let mesNum = null;
    if (month && typeof month === 'string') {
      mesNum = monthMap[month];
    } else if (month && typeof month === 'number') {
      mesNum = month;
    } else if (start_date) {
      // Extrair mês da data
      const date = new Date(start_date);
      mesNum = date.getMonth() + 1;
    }

    if (!mesNum || mesNum < 1 || mesNum > 12) {
      return res.status(400).json({ error: 'Mês inválido' });
    }

    // Verificar se já existe uma meta mensal para este mês e meta global
    const [existing] = await db.query(
      'SELECT * FROM metas_mensais_globais WHERE id_metas_globais = ? AND mes = ?',
      [id, mesNum]
    );

    if (existing && existing.length > 0) {
      return res.status(400).json({ error: 'Já existe uma meta mensal para este mês' });
    }

    // Inserir meta mensal
    const [result] = await db.query(
      `INSERT INTO metas_mensais_globais 
       (id_metas_globais, mes, data_inicio, data_fim, valor_alvo, valor_alcancado, status) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        mesNum,
        start_date || null,
        end_date || null,
        value_goal || 0,
        value_achieved || 0,
        'pendente'
      ]
    );

    // Buscar meta mensal criada
    const [created] = await db.query(
      'SELECT * FROM metas_mensais_globais WHERE id = ?',
      [result.insertId]
    );

    // Formatar resposta
    const formatted = {
      id: created[0].id,
      meta_global_id: created[0].id_metas_globais,
      mes: created[0].mes,
      start_date: created[0].data_inicio,
      end_date: created[0].data_fim,
      value_goal: created[0].valor_alvo,
      value_achieved: created[0].valor_alcancado,
      status: created[0].status,
      created_at: created[0].criado_em,
      updated_at: created[0].atualizado_em
    };

    res.status(201).json(formatted);

  } catch (error) {
    console.error('Erro ao criar meta mensal:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// GET /api/goals/:id/monthly-goals - Buscar metas mensais de uma meta global (USADO EM: GlobalGoalCard.js)
// IMPORTANTE: Esta rota deve vir ANTES de /:id para evitar conflito
router.get('/:id/monthly-goals', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { companyId } = req.query;

    if (!companyId) {
      return res.status(400).json({ error: 'ID da empresa é obrigatório' });
    }

    // Verificar se o usuário tem acesso à empresa
    const [userAccess] = await db.query(
      'SELECT empresa_id FROM usuarios_empresas WHERE usuario_id = ? AND empresa_id = ?',
      [req.user.id, companyId]
    );

    if (!userAccess || userAccess.length === 0) {
      return res.status(403).json({ error: 'Acesso negado a esta empresa' });
    }

    // Verificar se a meta global existe e pertence à empresa
    const [goal] = await db.query(
      'SELECT * FROM metas_globais WHERE id = ? AND empresa_id = ?',
      [id, companyId]
    );

    if (!goal || goal.length === 0) {
      return res.status(404).json({ error: 'Meta global não encontrada' });
    }

    // Buscar metas mensais da meta global
    let monthlyGoals = [];
    
    try {
      const [months] = await db.query(
        `SELECT * FROM metas_mensais_globais 
         WHERE id_metas_globais = ? 
         ORDER BY mes ASC, data_inicio ASC`,
        [id]
      );
      
      monthlyGoals = months || [];
      
      // Log para debug
      console.log(`[DEBUG] Meta global ID: ${id}, Metas mensais encontradas: ${monthlyGoals.length}`);
      if (monthlyGoals.length > 0) {
        console.log('[DEBUG] Primeira meta mensal:', monthlyGoals[0]);
      }
      
    } catch (tableError) {
      console.error('Erro ao buscar metas mensais:', tableError);
        monthlyGoals = [];
    }

    // Formatar os dados para o formato esperado pelo frontend
    // Schema correto: valor_alvo, valor_alcancado
    const formatted = monthlyGoals.map(month => ({
      id: month.id,
      meta_global_id: month.id_metas_globais,
      mes: month.mes,
      start_date: month.data_inicio,
      end_date: month.data_fim,
      value_goal: month.valor_alvo, // CORRIGIDO: era valor_meta, deve ser valor_alvo
      value_achieved: month.valor_alcancado,
      status: month.status,
      created_at: month.criado_em,
      updated_at: month.atualizado_em
    }));

    res.json(formatted);

  } catch (error) {
    console.error('Erro ao buscar metas mensais:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// PUT /api/goals/monthly-goals/:monthId - Atualizar meta mensal (USADO EM: GlobalGoalCard.js)
router.put('/monthly-goals/:monthId', verifyToken, async (req, res) => {
  try {
    const { monthId } = req.params;
    const { companyId, value_goal, value_achieved } = req.body;

    if (!companyId) {
      return res.status(400).json({ error: 'ID da empresa é obrigatório' });
    }

    // Verificar se o usuário tem acesso à empresa
    const [userAccess] = await db.query(
      'SELECT empresa_id FROM usuarios_empresas WHERE usuario_id = ? AND empresa_id = ?',
      [req.user.id, companyId]
    );

    if (!userAccess || userAccess.length === 0) {
      return res.status(403).json({ error: 'Acesso negado a esta empresa' });
    }

    // Verificar se a meta mensal existe
    const [monthlyGoal] = await db.query(
      'SELECT * FROM metas_mensais_globais WHERE id = ?',
      [monthId]
    );

    if (!monthlyGoal || monthlyGoal.length === 0) {
      return res.status(404).json({ error: 'Meta mensal não encontrada' });
    }

    // Verificar se a meta global pertence à empresa
    const [goal] = await db.query(
      'SELECT * FROM metas_globais WHERE id = ? AND empresa_id = ?',
      [monthlyGoal[0].id_metas_globais, companyId]
    );

    if (!goal || goal.length === 0) {
      return res.status(403).json({ error: 'Acesso negado a esta meta' });
    }

    // Atualizar meta mensal
    const updates = {};
    if (value_goal !== undefined) updates.valor_alvo = value_goal;
    if (value_achieved !== undefined) updates.valor_alcancado = value_achieved;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'Nenhum campo para atualizar' });
    }

    const fields = Object.keys(updates).map(key => `${key} = ?`).join(', ');
    const values = Object.values(updates);

    await db.query(
      `UPDATE metas_mensais_globais SET ${fields} WHERE id = ?`,
      [...values, monthId]
    );

    // Buscar meta mensal atualizada
    const [updated] = await db.query(
      'SELECT * FROM metas_mensais_globais WHERE id = ?',
      [monthId]
    );

    // Formatar resposta
    const formatted = {
      id: updated[0].id,
      meta_global_id: updated[0].id_metas_globais,
      mes: updated[0].mes,
      start_date: updated[0].data_inicio,
      end_date: updated[0].data_fim,
      value_goal: updated[0].valor_alvo,
      value_achieved: updated[0].valor_alcancado,
      status: updated[0].status,
      created_at: updated[0].criado_em,
      updated_at: updated[0].atualizado_em
    };

    res.json(formatted);

  } catch (error) {
    console.error('Erro ao atualizar meta mensal:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// DELETE /api/goals/monthly-goals/:monthId - Deletar meta mensal (USADO EM: GlobalGoalCard.js)
router.delete('/monthly-goals/:monthId', verifyToken, async (req, res) => {
  try {
    const { monthId } = req.params;
    const { companyId } = req.query;

    if (!companyId) {
      return res.status(400).json({ error: 'ID da empresa é obrigatório' });
    }

    // Verificar se o usuário tem acesso à empresa
    const [userAccess] = await db.query(
      'SELECT empresa_id FROM usuarios_empresas WHERE usuario_id = ? AND empresa_id = ?',
      [req.user.id, companyId]
    );

    if (!userAccess || userAccess.length === 0) {
      return res.status(403).json({ error: 'Acesso negado a esta empresa' });
    }

    // Verificar se a meta mensal existe
    const [monthlyGoal] = await db.query(
      'SELECT * FROM metas_mensais_globais WHERE id = ?',
      [monthId]
    );

    if (!monthlyGoal || monthlyGoal.length === 0) {
      return res.status(404).json({ error: 'Meta mensal não encontrada' });
    }

    // Verificar se a meta global pertence à empresa
    const [goal] = await db.query(
      'SELECT * FROM metas_globais WHERE id = ? AND empresa_id = ?',
      [monthlyGoal[0].id_metas_globais, companyId]
    );

    if (!goal || goal.length === 0) {
      return res.status(403).json({ error: 'Acesso negado a esta meta' });
    }

    // Deletar meta mensal
    await db.query(
      'DELETE FROM metas_mensais_globais WHERE id = ?',
      [monthId]
    );

    res.json({ message: 'Meta mensal deletada com sucesso' });

  } catch (error) {
    console.error('Erro ao deletar meta mensal:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// DELETE /api/goals/:id - Deletar meta global (USADO EM: goals.js como /global-goals/:id)
router.delete('/:id', verifyToken,  async (req, res) => {
  try {
    const { id } = req.params;

    await db.query(
      'DELETE FROM metas_globais WHERE id = ?',
      [id]
    );

    res.json({ message: 'Meta global deletada com sucesso' });

  } catch (error) {
    console.error('Erro ao deletar meta global:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

module.exports = router;

