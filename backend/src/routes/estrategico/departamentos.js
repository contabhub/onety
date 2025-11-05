const express = require('express');
const db = require('../../config/database.js');
const verifyToken = require('../../middlewares/auth');

const router = express.Router();

// GET /api/departments - Listar departamentos da empresa (USADO EM: kpis.js, goals.js)
router.get('/', verifyToken, async (req, res) => {
  try {
    const { companyId } = req.query;
    
    if (!companyId) {
      return res.status(400).json({ error: 'ID da empresa é obrigatório' });
    }

    // SUPERADMIN, ADMIN e RH têm acesso TOTAL a todos os departamentos - SEMPRE
    if (req.user.role !== 'SUPERADMIN' && req.user.role !== 'ADMIN' && req.user.role !== 'RH') {
      // Para outros roles, verificar se tem acesso à empresa
      const [userAccess] = await db.query(
        'SELECT empresa_id FROM usuarios_empresas WHERE usuario_id = ? AND empresa_id = ?',
        [req.user.id, companyId]
      );

      if (!userAccess || userAccess.length === 0) {
        return res.status(403).json({ error: 'Acesso negado a esta empresa' });
      }
    }

    // Aplicar filtros baseados no role do usuário
    let departmentFilter = null;
    
    if (req.user.role === 'GESTOR') {
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
      SELECT d.id, d.nome, d.descricao, d.parent_id, d.responsavel_id,
        u.id as manager_id_field,
        u.nome as manager_nome,
        u.email as manager_email,
        u.avatar_url as manager_avatar_url
      FROM departamentos d
      LEFT JOIN usuarios u ON d.responsavel_id = u.id
      WHERE d.empresa_id = ? AND d.status = 'ativo'
    `;
    const params = [companyId];

    // Aplicar filtro de departamento se necessário
    if (departmentFilter && departmentFilter.length > 0) {
      const placeholders = departmentFilter.map(() => '?').join(',');
      query += ` AND d.id IN (${placeholders})`;
      params.push(...departmentFilter);
    } else if (req.user.role !== 'SUPERADMIN' && req.user.role !== 'ADMIN' && req.user.role !== 'RH') {
      return res.json([]);
    }

    const [data] = await db.query(query, params);

    const departments = (data || []).map(d => ({
      id: d.id,
      name: d.nome,
      title: d.nome,
      description: d.descricao,
      parent_id: d.parent_id,
      manager: d.manager_id_field ? {
        id: d.manager_id_field,
        full_name: d.manager_nome,
        nome: d.manager_nome,
        email: d.manager_email,
        avatar_url: d.manager_avatar_url
      } : null
    }));

    res.json(departments);

  } catch (error) {
    console.error('Erro ao listar departamentos:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// GET /api/departments/leader/:userId - Buscar departamentos onde o usuário é líder (USADO EM: kpis.js)
router.get('/leader/:userId', verifyToken, async (req, res) => {
  try {
    const { userId } = req.params;
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

    // Buscar departamentos onde o usuário é líder
    const [leaderDepartments] = await db.query(
      `SELECT id, nome, descricao, parent_id, responsavel_id, empresa_id
       FROM departamentos
       WHERE responsavel_id = ? AND empresa_id = ? AND status = 'ativo'`,
      [userId, companyId]
    );

    // Formatar resposta para manter compatibilidade
    const formatted = (leaderDepartments || []).map(dept => ({
      id: dept.id,
      title: dept.nome,
      nome: dept.nome,
      description: dept.descricao,
      descricao: dept.descricao,
      parent_id: dept.parent_id,
      manager_id: dept.responsavel_id,
      responsavel_id: dept.responsavel_id,
      company_id: dept.empresa_id,
      empresa_id: dept.empresa_id
    }));

    res.json(formatted);

  } catch (error) {
    console.error('Erro ao buscar departamentos do líder:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// GET /api/departments/performance - Desempenho dos departamentos (USADO EM: organization.js)
router.get('/performance', verifyToken, async (req, res) => {
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

    // Buscar departamentos da empresa
    const [departments] = await db.query(
      'SELECT id FROM departamentos WHERE empresa_id = ? AND status = \'ativo\'',
      [companyId]
    );

    if (!departments || departments.length === 0) {
      return res.json([]);
    }

    const departmentIds = departments.map(d => d.id);

    // Buscar membros dos departamentos através de usuarios_empresas
    const [departmentMembers] = await db.query(
      `SELECT ue.usuario_id, ue.departamento_id, u.id as user_id_field, u.nome, u.email
       FROM usuarios_empresas ue
       LEFT JOIN usuarios u ON ue.usuario_id = u.id
       WHERE ue.departamento_id IN (${departmentIds.map(() => '?').join(',')}) AND ue.empresa_id = ?`,
      [...departmentIds, companyId]
    );

    // Buscar tarefas da empresa
    const [tasks] = await db.query(
      `SELECT id, responsavel_id, status
       FROM tarefas
       WHERE empresa_id = ?`,
      [companyId]
    );

    // Criar mapa de departamentos
    const departmentMap = new Map();
    departmentIds.forEach(deptId => {
      departmentMap.set(deptId, {
        department_id: deptId,
        tasks_total: 0,
        tasks_completed: 0,
        operational_tasks: 0,
        strategic_tasks: 0,
        employees: [],
      });
    });

    // Processar membros e suas tarefas
    (departmentMembers || []).forEach((member) => {
      const departmentId = member.departamento_id;
      
      if (!member.user_id_field) return;

      const employeeTasks = (tasks || []).filter(task => task.responsavel_id === member.user_id_field);
      const totalTasks = employeeTasks.length;
      const completedTasks = employeeTasks.filter((task) => 
        task.status === 'concluída' || task.status === 'concluida'
      ).length;

      const departmentData = departmentMap.get(departmentId);
      if (departmentData) {
        departmentData.tasks_total += totalTasks;
        departmentData.tasks_completed += completedTasks;
        // Nota: task_classification não existe na tabela tarefas, mantendo campos mas zerados
        departmentData.operational_tasks += 0;
        departmentData.strategic_tasks += 0;
        departmentData.employees.push({
          id: member.user_id_field,
          full_name: member.nome,
          nome: member.nome,
          email: member.email,
          tasks_total: totalTasks,
          tasks_completed: completedTasks,
          completion_rate: totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0,
          operational_tasks: 0,
          strategic_tasks: 0,
          on_time_completion_rate: 0,
        });
      }
    });

    res.json(Array.from(departmentMap.values()));

  } catch (error) {
    console.error('Erro ao buscar desempenho dos departamentos:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// GET /api/departments/:id - Buscar departamento por ID
router.get('/:id', verifyToken, async (req, res) => {
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

    // Buscar departamento
    const [departments] = await db.query(
      `SELECT d.id, d.nome, d.descricao, d.parent_id, d.responsavel_id, d.empresa_id,
        u.id as manager_id_field,
        u.nome as manager_nome,
        u.email as manager_email,
        u.avatar_url as manager_avatar_url
      FROM departamentos d
      LEFT JOIN usuarios u ON d.responsavel_id = u.id
      WHERE d.id = ? AND d.empresa_id = ? AND d.status = 'ativo'`,
      [id, companyId]
    );

    if (!departments || departments.length === 0) {
      return res.status(404).json({ error: 'Departamento não encontrado' });
    }

    const department = departments[0];

    const formatted = {
      id: department.id,
      name: department.nome,
      title: department.nome,
      description: department.descricao,
      parent_id: department.parent_id,
      manager_id: department.responsavel_id,
      responsavel_id: department.responsavel_id,
      company_id: department.empresa_id,
      empresa_id: department.empresa_id,
      manager: department.manager_id_field ? {
        id: department.manager_id_field,
        full_name: department.manager_nome,
        nome: department.manager_nome,
        email: department.manager_email,
        avatar_url: department.manager_avatar_url
      } : null
    };

    res.json(formatted);

  } catch (error) {
    console.error('Erro ao buscar departamento:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// PUT /api/departments/:id - Atualizar departamento (USADO EM: organization.js)
router.put('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, manager_id, parent_id } = req.body;

    // Verificar se o departamento existe
    const [existing] = await db.query(
      'SELECT empresa_id FROM departamentos WHERE id = ?',
      [id]
    );

    if (!existing || existing.length === 0) {
      return res.status(404).json({ error: 'Departamento não encontrado' });
    }

    // Verificar se o usuário tem acesso à empresa
    const [userAccess] = await db.query(
      'SELECT empresa_id FROM usuarios_empresas WHERE usuario_id = ? AND empresa_id = ?',
      [req.user.id, existing[0].empresa_id]
    );

    if (!userAccess || userAccess.length === 0) {
      return res.status(403).json({ error: 'Acesso negado a esta empresa' });
    }

    // Atualizar departamento
    await db.query(
      `UPDATE departamentos SET nome = ?, descricao = ?, responsavel_id = ?, parent_id = ? WHERE id = ?`,
      [title, description, manager_id || null, parent_id || null, id]
    );

    // Buscar departamento atualizado
    const [updated] = await db.query(
      `SELECT d.*, 
        u.id as manager_id_field,
        u.nome as manager_nome,
        u.avatar_url as manager_avatar_url
      FROM departamentos d
      LEFT JOIN usuarios u ON d.responsavel_id = u.id
      WHERE d.id = ?`,
      [id]
    );

    const formatted = updated[0] ? {
      ...updated[0],
      title: updated[0].nome,
      nome: updated[0].nome,
      description: updated[0].descricao,
      descricao: updated[0].descricao,
      manager_id: updated[0].responsavel_id,
      responsavel_id: updated[0].responsavel_id,
      company_id: updated[0].empresa_id,
      empresa_id: updated[0].empresa_id,
      manager: updated[0].manager_id_field ? {
        id: updated[0].manager_id_field,
        full_name: updated[0].manager_nome,
        nome: updated[0].manager_nome,
        avatar_url: updated[0].manager_avatar_url
      } : null
    } : null;

    res.json(formatted);

  } catch (error) {
    console.error('Erro ao atualizar departamento:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// POST /api/departments - Criar departamento (USADO EM: organization.js)
router.post('/', verifyToken, async (req, res) => {
  try {
    const { companyId, title, description, manager_id, parent_id } = req.body;

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

    // Verificar se já existe um departamento raiz
    if (!parent_id) {
      const [existingRoot] = await db.query(
        'SELECT id, nome FROM departamentos WHERE empresa_id = ? AND parent_id IS NULL AND status = \'ativo\'',
        [companyId]
      );

      if (existingRoot && existingRoot.length > 0) {
        return res.status(400).json({ 
          error: 'Já existe um departamento raiz. Só é permitido um departamento sem superior.',
          existingRoot: {
            id: existingRoot[0].id,
            title: existingRoot[0].nome,
            nome: existingRoot[0].nome
          }
        });
      }
    }

    // Inserir departamento
    const [result] = await db.query(
      `INSERT INTO departamentos (empresa_id, nome, descricao, responsavel_id, parent_id, nivel, status) 
       VALUES (?, ?, ?, ?, ?, ?, 'ativo')`,
      [companyId, title, description, manager_id || null, parent_id || null, 1]
    );

    // Buscar departamento criado
    const [created] = await db.query(
      `SELECT d.*, 
        u.id as manager_id_field,
        u.nome as manager_nome,
        u.avatar_url as manager_avatar_url
      FROM departamentos d
      LEFT JOIN usuarios u ON d.responsavel_id = u.id
      WHERE d.id = ?`,
      [result.insertId]
    );

    const formatted = created[0] ? {
      ...created[0],
      title: created[0].nome,
      nome: created[0].nome,
      description: created[0].descricao,
      descricao: created[0].descricao,
      manager_id: created[0].responsavel_id,
      responsavel_id: created[0].responsavel_id,
      company_id: created[0].empresa_id,
      empresa_id: created[0].empresa_id,
      level: created[0].nivel,
      nivel: created[0].nivel,
      manager: created[0].manager_id_field ? {
        id: created[0].manager_id_field,
        full_name: created[0].manager_nome,
        nome: created[0].manager_nome,
        avatar_url: created[0].manager_avatar_url
      } : null
    } : null;

    res.status(201).json(formatted);

  } catch (error) {
    console.error('Erro ao criar departamento:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

module.exports = router;

