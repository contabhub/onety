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

    // Agrupar monthlyGoals por meta
    const grouped = {};
    monthlyGoals.forEach(m => {
      const key = m.id_metas_departamentais;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(m);
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

      // Aplicar filtros baseados no role do usuário
      let departmentFilter = null;
      
      if (req.user.role === 'SUPERADMIN' || req.user.role === 'ADMIN' || req.user.role === 'RH') {
        // SUPERADMIN, ADMIN e RH podem ver tudo
      } else if (req.user.role === 'GESTOR') {
        // GESTOR pode ver só do seu departamento e do seu time
        const [userDepartments] = await db.query(
          'SELECT departamento_id FROM usuarios_empresas WHERE usuario_id = ? AND departamento_id IS NOT NULL',
          [req.user.id]
        );
        
        if (userDepartments && userDepartments.length > 0) {
          departmentFilter = userDepartments.map(d => d.departamento_id);
        }
      } else if (req.user.role === 'FUNCIONARIO') {
        // FUNCIONARIO pode ver do seu departamento e do departamento que é líder
        const [userDepartments] = await db.query(
          'SELECT departamento_id FROM usuarios_empresas WHERE usuario_id = ? AND departamento_id IS NOT NULL',
          [req.user.id]
        );
        
        const [leaderDepartments] = await db.query(
          'SELECT id FROM departamentos WHERE responsavel_id = ?',
          [req.user.id]
        );
        
        let allDepartments = [];
        if (userDepartments && userDepartments.length > 0) {
          allDepartments = allDepartments.concat(userDepartments.map(d => d.departamento_id));
        }
        if (leaderDepartments && leaderDepartments.length > 0) {
          allDepartments = allDepartments.concat(leaderDepartments.map(d => d.id));
        }
        
        departmentFilter = [...new Set(allDepartments)];
      }

      // Construir query base
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

      // Aplicar filtro de departamento se necessário
      if (departmentFilter && departmentFilter.length > 0) {
        const placeholders = departmentFilter.map(() => '?').join(',');
        query += ` AND md.departamento_id IN (${placeholders})`;
        params.push(...departmentFilter);
      } else if (req.user.role !== 'SUPERADMIN' && req.user.role !== 'ADMIN' && req.user.role !== 'RH') {
        return res.json({
          data: [],
          pagination: {
            currentPage: parseInt(page),
            totalPages: 0,
            totalCount: 0,
            limit: parseInt(limit),
            hasNextPage: false,
            hasPrevPage: false
          }
        });
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
      const countQuery = query.replace('SELECT md.*,', 'SELECT COUNT(*) as total').replace('LEFT JOIN departamentos d ON md.departamento_id = d.id', '').replace('d.id as department_id, d.nome as department_title, d.descricao as department_description, d.empresa_id as department_company_id', '');
      const [countRows] = await db.query(countQuery, params);
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

      // Agrupar monthlyGoals
      const grouped = {};
      monthlyGoals.forEach(m => {
        const key = m.id_metas_departamentais;
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(m);
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

module.exports = router;

