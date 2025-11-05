const express = require('express');
const db = require('../../config/database.js');
const verifyToken = require('../../middlewares/auth');

const router = express.Router();

// GET /api/department-goals/organization - Rota específica para o organograma (USADO EM: organization.js)
router.get('/organization', verifyToken, async (req, res) => {
  try {
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

    // Buscar todas as metas departamentais da empresa (sem paginação)
    const [goals] = await db.query(
      `SELECT md.*, 
        d.id as department_id, 
        d.nome as department_title,
        d.descricao as department_description,
        d.empresa_id as department_company_id
      FROM metas_departamentais md
      LEFT JOIN departamentos d ON md.departamento_id = d.id
      WHERE md.empresa_id = ? AND d.status = 'ativo'
      ORDER BY md.criado_em DESC`,
      [companyId]
    );

    // Buscar monthlyGoals para cada meta departamental
    const goalIds = (goals || []).map(g => g.id);
    let monthlyGoals = [];
    
    if (goalIds.length > 0) {
      const placeholders = goalIds.map(() => '?').join(',');
      const [months] = await db.query(
        `SELECT * FROM metas_mensais_departamentais 
         WHERE id_metas_departamentais IN (${placeholders})
         ORDER BY data_inicio ASC`,
        goalIds
      );
      monthlyGoals = months || [];
    }

    // Agrupar monthlyGoals por meta e formatar
    const grouped = {};
    monthlyGoals.forEach(m => {
      const key = m.id_metas_departamentais;
      if (!grouped[key]) grouped[key] = [];
      // Formatar campos do banco para o formato esperado pelo frontend
      grouped[key].push({
        id: m.id,
        meta_departamental_id: m.id_metas_departamentais,
        start_date: m.data_inicio,
        end_date: m.data_fim,
        value_goal: m.valor_alvo,
        value_achieved: m.valor_alcancado,
        status: m.status,
        created_at: m.criado_em,
        updated_at: m.atualizado_em
      });
    });

    // Anexar monthlyGoals a cada meta
    const dataWithMonths = (goals || []).map(g => ({
      ...g,
      department: g.department_id ? {
        id: g.department_id,
        title: g.department_title,
        nome: g.department_title,
        description: g.department_description,
        descricao: g.department_description,
        company_id: g.department_company_id,
        empresa_id: g.department_company_id
      } : null,
      monthlyGoals: grouped[g.id] || []
    }));

    res.json(dataWithMonths);

  } catch (error) {
    console.error('Erro ao listar metas departamentais para organograma:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// GET /api/department-goals - Listar metas do departamento (USADO EM: goals.js)
router.get('/', verifyToken, async (req, res) => {
  try {
    const { departmentId, companyId, page = 1, limit = 10, trimestre, ano } = req.query;

    // Se companyId for fornecido, buscar todas as metas da empresa
    if (companyId) {
      // Verificar se o usuário tem acesso à empresa
      const [userCompany] = await db.query(
        'SELECT * FROM usuarios_empresas WHERE usuario_id = ? AND empresa_id = ?',
        [req.user.id, companyId]
      );

      if (!userCompany || userCompany.length === 0) {
        return res.status(403).json({ error: 'Acesso negado a esta empresa' });
      }

      // Construir query base - retornar TODAS as metas departamentais da empresa
      let query = `
        SELECT md.*, 
          d.id as department_id, 
          d.nome as department_title,
          d.descricao as department_description,
          d.empresa_id as department_company_id
        FROM metas_departamentais md
        LEFT JOIN departamentos d ON md.departamento_id = d.id
        WHERE md.empresa_id = ? AND d.status = 'ativo'
      `;
      const params = [companyId];

      // Aplicar filtro por departamento se fornecido
      if (departmentId) {
        query += ' AND md.departamento_id = ?';
        params.push(departmentId);
      }

      // Aplicar filtros se fornecidos
      if (trimestre) {
        const trimestreNum = parseInt(trimestre);
        let startMonth, endMonth;
        
        if (trimestreNum === 1) { startMonth = 0; endMonth = 2; }
        else if (trimestreNum === 2) { startMonth = 3; endMonth = 5; }
        else if (trimestreNum === 3) { startMonth = 6; endMonth = 8; }
        else if (trimestreNum === 4) { startMonth = 9; endMonth = 11; }

        if (startMonth !== undefined && endMonth !== undefined) {
          const yearToUse = ano ? parseInt(ano) : new Date().getFullYear();
          const startDate = `${yearToUse}-${String(startMonth + 1).padStart(2, '0')}-01`;
          const endDate = `${yearToUse}-${String(endMonth + 1).padStart(2, '0')}-${new Date(yearToUse, endMonth + 1, 0).getDate()}`;
          query += ' AND md.data_inicio >= ? AND md.data_inicio <= ?';
          params.push(startDate, endDate);
        }
      } else if (ano) {
        const anoNum = parseInt(ano);
        const startDate = `${anoNum}-01-01`;
        const endDate = `${anoNum}-12-31`;
        query += ' AND md.data_inicio >= ? AND md.data_inicio <= ?';
        params.push(startDate, endDate);
      }

      // Buscar total de registros para paginação
      // Criar query de contagem baseada nas mesmas condições
      let countQuery = `
        SELECT COUNT(*) as total
        FROM metas_departamentais md
        LEFT JOIN departamentos d ON md.departamento_id = d.id
        WHERE md.empresa_id = ? AND d.status = 'ativo'
      `;
      const countParams = [companyId];
      
      // Aplicar mesmos filtros na query de contagem
      if (departmentId) {
        countQuery += ' AND md.departamento_id = ?';
        countParams.push(departmentId);
      }
      
      if (trimestre) {
        const trimestreNum = parseInt(trimestre);
        let startMonth, endMonth;
        
        if (trimestreNum === 1) { startMonth = 0; endMonth = 2; }
        else if (trimestreNum === 2) { startMonth = 3; endMonth = 5; }
        else if (trimestreNum === 3) { startMonth = 6; endMonth = 8; }
        else if (trimestreNum === 4) { startMonth = 9; endMonth = 11; }

        if (startMonth !== undefined && endMonth !== undefined) {
          const yearToUse = ano ? parseInt(ano) : new Date().getFullYear();
          const startDate = `${yearToUse}-${String(startMonth + 1).padStart(2, '0')}-01`;
          const endDate = `${yearToUse}-${String(endMonth + 1).padStart(2, '0')}-${new Date(yearToUse, endMonth + 1, 0).getDate()}`;
          countQuery += ' AND md.data_inicio >= ? AND md.data_inicio <= ?';
          countParams.push(startDate, endDate);
        }
      } else if (ano) {
        const anoNum = parseInt(ano);
        const startDate = `${anoNum}-01-01`;
        const endDate = `${anoNum}-12-31`;
        countQuery += ' AND md.data_inicio >= ? AND md.data_inicio <= ?';
        countParams.push(startDate, endDate);
      }
      
      const [countRows] = await db.query(countQuery, countParams);
      const totalCount = countRows[0]?.total || 0;

      // Calcular offset para paginação
      const offset = (parseInt(page) - 1) * parseInt(limit);
      query += ' ORDER BY md.criado_em DESC LIMIT ? OFFSET ?';
      params.push(parseInt(limit), offset);

      // Buscar dados paginados
      const [goals] = await db.query(query, params);

      // Buscar monthlyGoals
      const goalIds = (goals || []).map(g => g.id);
      let monthlyGoals = [];
      
      if (goalIds.length > 0) {
        const placeholders = goalIds.map(() => '?').join(',');
        const [months] = await db.query(
          `SELECT * FROM metas_mensais_departamentais 
           WHERE id_metas_departamentais IN (${placeholders})
           ORDER BY data_inicio ASC`,
          goalIds
        );
        monthlyGoals = months || [];
      }

      // Agrupar monthlyGoals e formatar
      const grouped = {};
      monthlyGoals.forEach(m => {
        const key = m.id_metas_departamentais;
        if (!grouped[key]) grouped[key] = [];
        // Formatar campos do banco para o formato esperado pelo frontend
        grouped[key].push({
          id: m.id,
          meta_departamental_id: m.id_metas_departamentais,
          start_date: m.data_inicio,
          end_date: m.data_fim,
          value_goal: m.valor_alvo,
          value_achieved: m.valor_alcancado,
          status: m.status,
          created_at: m.criado_em,
          updated_at: m.atualizado_em
        });
      });

      // Anexar monthlyGoals
      const dataWithMonths = (goals || []).map(g => ({
        ...g,
        department: g.department_id ? {
          id: g.department_id,
          title: g.department_title,
          nome: g.department_title,
          description: g.department_description,
          descricao: g.department_description,
          company_id: g.department_company_id,
          empresa_id: g.department_company_id
        } : null,
        monthlyGoals: grouped[g.id] || []
      }));

      // Calcular informações de paginação
      const totalPages = Math.ceil((totalCount || 0) / parseInt(limit));
      const hasNextPage = parseInt(page) < totalPages;
      const hasPrevPage = parseInt(page) > 1;

      return res.json({
        data: dataWithMonths,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalCount,
          hasNextPage,
          hasPrevPage,
          limit: parseInt(limit)
        }
      });
    }

    // Se departmentId for fornecido, buscar metas do departamento específico
    if (!departmentId) {
      return res.status(400).json({ error: 'ID do departamento é obrigatório' });
    }

    // Buscar o departamento para obter o empresa_id
    const [department] = await db.query(
      'SELECT empresa_id FROM departamentos WHERE id = ? AND status = \'ativo\'',
      [departmentId]
    );

    if (!department || department.length === 0) {
      return res.status(404).json({ error: 'Departamento não encontrado' });
    }

    // Verificar se o usuário tem acesso à empresa
    const [userCompany] = await db.query(
      'SELECT * FROM usuarios_empresas WHERE usuario_id = ? AND empresa_id = ?',
      [req.user.id, department[0].empresa_id]
    );

    if (!userCompany || userCompany.length === 0) {
      return res.status(403).json({ error: 'Acesso negado a esta empresa' });
    }

    // Construir query base
    let query = 'SELECT * FROM metas_departamentais WHERE departamento_id = ?';
    const params = [departmentId];

    // Aplicar filtros se fornecidos
    if (trimestre) {
      const trimestreNum = parseInt(trimestre);
      let startMonth, endMonth;
      
      if (trimestreNum === 1) { startMonth = 0; endMonth = 2; }
      else if (trimestreNum === 2) { startMonth = 3; endMonth = 5; }
      else if (trimestreNum === 3) { startMonth = 6; endMonth = 8; }
      else if (trimestreNum === 4) { startMonth = 9; endMonth = 11; }

      if (startMonth !== undefined && endMonth !== undefined) {
        const yearToUse = ano ? parseInt(ano) : new Date().getFullYear();
        const startDate = `${yearToUse}-${String(startMonth + 1).padStart(2, '0')}-01`;
        const endDate = `${yearToUse}-${String(endMonth + 1).padStart(2, '0')}-${new Date(yearToUse, endMonth + 1, 0).getDate()}`;
        query += ' AND data_inicio >= ? AND data_inicio <= ?';
        params.push(startDate, endDate);
      }
    } else if (ano) {
      const anoNum = parseInt(ano);
      const startDate = `${anoNum}-01-01`;
      const endDate = `${anoNum}-12-31`;
      query += ' AND data_inicio >= ? AND data_inicio <= ?';
      params.push(startDate, endDate);
    }

    // Calcular offset para paginação
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Buscar total de registros para paginação
    const [countRows] = await db.query(
      query.replace('SELECT *', 'SELECT COUNT(*) as total'),
      params
    );
    const totalCount = countRows[0]?.total || 0;

    // Buscar dados paginados
    query += ' ORDER BY criado_em DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);
    const [goals] = await db.query(query, params);

    // Anexar monthlyGoals
    const goalIds = (goals || []).map(g => g.id);
    let monthlyGoals = [];
    
    if (goalIds.length > 0) {
      const placeholders = goalIds.map(() => '?').join(',');
      const [months] = await db.query(
        `SELECT * FROM metas_mensais_departamentais 
         WHERE id_metas_departamentais IN (${placeholders})
         ORDER BY data_inicio ASC`,
        goalIds
      );
      monthlyGoals = months || [];
    }

    const grouped = {};
    monthlyGoals.forEach(m => {
      const key = m.id_metas_departamentais;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(m);
    });

    const dataWithMonths = (goals || []).map(g => ({
      ...g,
      monthlyGoals: grouped[g.id] || []
    }));

    // Calcular informações de paginação
    const totalPages = Math.ceil((totalCount || 0) / parseInt(limit));
    const hasNextPage = parseInt(page) < totalPages;
    const hasPrevPage = parseInt(page) > 1;

    res.json({
      data: dataWithMonths,
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
    console.error('Erro ao listar metas do departamento:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// POST /api/department-goals - Criar meta departamental (USADO EM: DepartmentGoalModal.js)
router.post('/', verifyToken, async (req, res) => {
  try {
    const { company_id, department_id, title, description, target_value, current_value, start_date, end_date, status, calculation_type, indicator_type, progress_type } = req.body;

    if (!company_id || !department_id) {
      return res.status(400).json({ error: 'ID da empresa e ID do departamento são obrigatórios' });
    }

    // Verificar se o usuário tem acesso à empresa
    const [userAccess] = await db.query(
      'SELECT empresa_id FROM usuarios_empresas WHERE usuario_id = ? AND empresa_id = ?',
      [req.user.id, company_id]
    );

    if (!userAccess || userAccess.length === 0) {
      return res.status(403).json({ error: 'Acesso negado a esta empresa' });
    }

    // Verificar se o departamento existe e pertence à empresa
    const [department] = await db.query(
      'SELECT id FROM departamentos WHERE id = ? AND empresa_id = ? AND status = \'ativo\'',
      [department_id, company_id]
    );

    if (!department || department.length === 0) {
      return res.status(404).json({ error: 'Departamento não encontrado' });
    }

    // Mapear campos do payload para o schema
    const fieldMapping = {
      title: 'nome',
      description: 'descricao',
      target_value: 'valor_alvo',
      current_value: 'valor_atual',
      start_date: 'data_inicio',
      end_date: 'data_fim',
      status: 'status',
      calculation_type: 'calculo_tipo',
      indicator_type: 'indicador_tipo',
      progress_type: 'progresso_tipo'
    };

    // Preparar dados para inserção
    const insertData = {
      empresa_id: company_id,
      departamento_id: department_id,
      nome: title || null,
      descricao: description || null,
      valor_alvo: target_value || null,
      valor_atual: current_value || 0,
      data_inicio: start_date || null,
      data_fim: end_date || null,
      status: status || 'in_progress',
      calculo_tipo: calculation_type || null,
      indicador_tipo: indicator_type || null,
      progresso_tipo: progress_type || null
    };

    // Inserir meta departamental
    const fields = Object.keys(insertData).join(', ');
    const values = Object.values(insertData);
    const placeholders = values.map(() => '?').join(', ');
    
    const [result] = await db.query(
      `INSERT INTO metas_departamentais (${fields}) VALUES (${placeholders})`,
      values
    );

    // Buscar meta criada
    const [data] = await db.query(
      'SELECT * FROM metas_departamentais WHERE id = ?',
      [result.insertId]
    );

    res.status(201).json(data[0]);

  } catch (error) {
    console.error('Erro ao criar meta departamental:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// PUT /api/department-goals/:id - Atualizar meta departamental (USADO EM: DepartmentGoalModal.js)
router.put('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { department_id, title, description, target_value, start_date, end_date, calculation_type, indicator_type, progress_type } = req.body;

    // Verificar se a meta existe
    const [existing] = await db.query(
      'SELECT empresa_id FROM metas_departamentais WHERE id = ?',
      [id]
    );

    if (!existing || existing.length === 0) {
      return res.status(404).json({ error: 'Meta departamental não encontrada' });
    }

    // Verificar se o usuário tem acesso à empresa
    const [userAccess] = await db.query(
      'SELECT empresa_id FROM usuarios_empresas WHERE usuario_id = ? AND empresa_id = ?',
      [req.user.id, existing[0].empresa_id]
    );

    if (!userAccess || userAccess.length === 0) {
      return res.status(403).json({ error: 'Acesso negado a esta empresa' });
    }

    // Mapear campos do payload para o schema
    const updates = {};
    if (department_id !== undefined) updates.departamento_id = department_id;
    if (title !== undefined) updates.nome = title;
    if (description !== undefined) updates.descricao = description;
    if (target_value !== undefined) updates.valor_alvo = target_value;
    if (start_date !== undefined) updates.data_inicio = start_date;
    if (end_date !== undefined) updates.data_fim = end_date;
    if (calculation_type !== undefined) updates.calculo_tipo = calculation_type;
    if (indicator_type !== undefined) updates.indicador_tipo = indicator_type;
    if (progress_type !== undefined) updates.progresso_tipo = progress_type;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'Nenhum campo para atualizar' });
    }

    const fields = Object.keys(updates).map(key => `${key} = ?`).join(', ');
    const values = Object.values(updates);

    await db.query(
      `UPDATE metas_departamentais SET ${fields} WHERE id = ?`,
      [...values, id]
    );

    // Buscar meta atualizada
    const [data] = await db.query(
      'SELECT * FROM metas_departamentais WHERE id = ?',
      [id]
    );

    res.json(data[0]);

  } catch (error) {
    console.error('Erro ao atualizar meta departamental:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// POST /api/department-goals/:id/monthly-goals ou /:id/months - Criar meta mensal para uma meta departamental (USADO EM: DepartmentGoalCard.js)
router.post('/:id/monthly-goals', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { companyId, start_date, end_date, value_goal, value_achieved, status } = req.body;

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

    // Verificar se a meta departamental existe e pertence à empresa
    const [goal] = await db.query(
      'SELECT * FROM metas_departamentais WHERE id = ? AND empresa_id = ?',
      [id, companyId]
    );

    if (!goal || goal.length === 0) {
      return res.status(404).json({ error: 'Meta departamental não encontrada' });
    }

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

    const formattedStartDate = formatDateForMySQL(start_date);
    const formattedEndDate = formatDateForMySQL(end_date);

    // Verificar se já existe uma meta mensal para este período
    if (formattedStartDate && formattedEndDate) {
      const [existing] = await db.query(
        `SELECT * FROM metas_mensais_departamentais 
         WHERE id_metas_departamentais = ? 
         AND (
           (data_inicio <= ? AND data_fim >= ?) OR
           (data_inicio <= ? AND data_fim >= ?) OR
           (data_inicio >= ? AND data_fim <= ?)
         )`,
        [id, formattedStartDate, formattedStartDate, formattedEndDate, formattedEndDate, formattedStartDate, formattedEndDate]
      );

      if (existing && existing.length > 0) {
        return res.status(400).json({ error: 'Já existe uma meta mensal para este período' });
      }
    }

    // Inserir meta mensal
    const [result] = await db.query(
      `INSERT INTO metas_mensais_departamentais 
       (id_metas_departamentais, data_inicio, data_fim, valor_alvo, valor_alcancado, status) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        id,
        formattedStartDate,
        formattedEndDate,
        value_goal || 0,
        value_achieved || 0,
        status === false ? 'pendente' : (status || 'pendente')
      ]
    );

    // Buscar meta mensal criada
    const [created] = await db.query(
      'SELECT * FROM metas_mensais_departamentais WHERE id = ?',
      [result.insertId]
    );

    // Formatar resposta
    const formatted = {
      id: created[0].id,
      meta_departamental_id: created[0].id_metas_departamentais,
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
    console.error('Erro ao criar meta mensal departamental:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Rota alternativa POST /:id/months (mesma funcionalidade)
router.post('/:id/months', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { companyId, start_date, end_date, value_goal, value_achieved, status } = req.body;

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

    // Verificar se a meta departamental existe e pertence à empresa
    const [goal] = await db.query(
      'SELECT * FROM metas_departamentais WHERE id = ? AND empresa_id = ?',
      [id, companyId]
    );

    if (!goal || goal.length === 0) {
      return res.status(404).json({ error: 'Meta departamental não encontrada' });
    }

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

    const formattedStartDate = formatDateForMySQL(start_date);
    const formattedEndDate = formatDateForMySQL(end_date);

    // Verificar se já existe uma meta mensal para este período
    if (formattedStartDate && formattedEndDate) {
      const [existing] = await db.query(
        `SELECT * FROM metas_mensais_departamentais 
         WHERE id_metas_departamentais = ? 
         AND (
           (data_inicio <= ? AND data_fim >= ?) OR
           (data_inicio <= ? AND data_fim >= ?) OR
           (data_inicio >= ? AND data_fim <= ?)
         )`,
        [id, formattedStartDate, formattedStartDate, formattedEndDate, formattedEndDate, formattedStartDate, formattedEndDate]
      );

      if (existing && existing.length > 0) {
        return res.status(400).json({ error: 'Já existe uma meta mensal para este período' });
      }
    }

    // Inserir meta mensal
    const [result] = await db.query(
      `INSERT INTO metas_mensais_departamentais 
       (id_metas_departamentais, data_inicio, data_fim, valor_alvo, valor_alcancado, status) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        id,
        formattedStartDate,
        formattedEndDate,
        value_goal || 0,
        value_achieved || 0,
        status === false ? 'pendente' : (status || 'pendente')
      ]
    );

    // Buscar meta mensal criada
    const [created] = await db.query(
      'SELECT * FROM metas_mensais_departamentais WHERE id = ?',
      [result.insertId]
    );

    // Formatar resposta
    const formatted = {
      id: created[0].id,
      meta_departamental_id: created[0].id_metas_departamentais,
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
    console.error('Erro ao criar meta mensal departamental:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// PUT /api/department-goals/monthly-goals/:monthId - Atualizar meta mensal departamental (USADO EM: MonthlyGoalRow.js)
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

    // Verificar se a meta mensal existe e pertence a uma meta departamental da empresa
    const [monthlyGoal] = await db.query(
      `SELECT mmd.*, md.empresa_id 
       FROM metas_mensais_departamentais mmd
       INNER JOIN metas_departamentais md ON mmd.id_metas_departamentais = md.id
       WHERE mmd.id = ? AND md.empresa_id = ?`,
      [monthId, companyId]
    );

    if (!monthlyGoal || monthlyGoal.length === 0) {
      return res.status(404).json({ error: 'Meta mensal não encontrada' });
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
      `UPDATE metas_mensais_departamentais SET ${fields} WHERE id = ?`,
      [...values, monthId]
    );

    // Buscar meta mensal atualizada
    const [updated] = await db.query(
      'SELECT * FROM metas_mensais_departamentais WHERE id = ?',
      [monthId]
    );

    // Formatar resposta
    const formatted = {
      id: updated[0].id,
      meta_departamental_id: updated[0].id_metas_departamentais,
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
    console.error('Erro ao atualizar meta mensal departamental:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// DELETE /api/department-goals/monthly-goals/:monthId - Deletar meta mensal departamental (USADO EM: MonthlyGoalRow.js)
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

    // Verificar se a meta mensal existe e pertence a uma meta departamental da empresa
    const [monthlyGoal] = await db.query(
      `SELECT mmd.*, md.empresa_id 
       FROM metas_mensais_departamentais mmd
       INNER JOIN metas_departamentais md ON mmd.id_metas_departamentais = md.id
       WHERE mmd.id = ? AND md.empresa_id = ?`,
      [monthId, companyId]
    );

    if (!monthlyGoal || monthlyGoal.length === 0) {
      return res.status(404).json({ error: 'Meta mensal não encontrada' });
    }

    // Deletar meta mensal
    await db.query(
      'DELETE FROM metas_mensais_departamentais WHERE id = ?',
      [monthId]
    );

    res.json({ message: 'Meta mensal deletada com sucesso' });

  } catch (error) {
    console.error('Erro ao deletar meta mensal departamental:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

module.exports = router;

