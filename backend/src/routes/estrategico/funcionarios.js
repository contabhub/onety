const express = require('express');
const db = require('../../config/database.js');
const verifyToken = require('../../middlewares/auth');

const router = express.Router();

// GET /api/employees - Listar funcionários da empresa (USADO EM: organization.js)
router.get('/', verifyToken, async (req, res) => {
  try {
    const { companyId } = req.query;
    
    if (!companyId) {
      return res.status(400).json({ error: 'ID da empresa é obrigatório' });
    }

    // Verificar se o usuário tem acesso à empresa
    const [userAccess] = await db.query(
      `SELECT ue.empresa_id, c.nome as role_name
       FROM usuarios_empresas ue
       LEFT JOIN cargos c ON ue.cargo_id = c.id
       WHERE ue.usuario_id = ? AND ue.empresa_id = ?`,
      [req.user.id, companyId]
    );

    if (!userAccess || userAccess.length === 0) {
      return res.status(403).json({ error: 'Acesso negado a esta empresa' });
    }

    // Converter companyId para número para garantir comparação correta
    const companyIdNum = Number(companyId);
    
    console.log('🔍 [funcionarios] Buscando funcionários para companyId:', companyIdNum, 'tipo:', typeof companyIdNum);
    console.log('🔍 [funcionarios] req.user.id:', req.user.id);

    // Buscar TODOS os usuários vinculados à empresa
    const [users] = await db.query(
      `SELECT u.id, u.nome, u.email, u.telefone, u.avatar_url, u.status as usuario_status,
        ue.empresa_id,
        ue.departamento_id,
        c.nome as role_name,
        d.nome as department_title,
        d.empresa_id as department_company_id
      FROM usuarios u
      INNER JOIN usuarios_empresas ue ON u.id = ue.usuario_id
      LEFT JOIN cargos c ON ue.cargo_id = c.id
      LEFT JOIN departamentos d ON ue.departamento_id = d.id AND d.empresa_id = ? AND d.status = 'ativo'
      WHERE ue.empresa_id = ? AND u.status = 'ativo'`,
      [companyIdNum, companyIdNum]
    );

    console.log('🔍 [funcionarios] Usuários encontrados na query:', users?.length || 0);
    if (users && users.length > 0) {
      console.log('🔍 [funcionarios] Primeiros usuários:', users.slice(0, 3).map(u => ({
        id: u.id,
        nome: u.nome,
        empresa_id: u.empresa_id,
        role_name: u.role_name,
        usuario_status: u.usuario_status
      })));
    }

    // FILTRO: Apenas remover SUPERADMIN (incluir ADMIN e outros)
    const filtered = (users || []).filter(user => {
      // Verifica se o usuário tem vínculo com a empresa (comparar como número)
      const userEmpresaId = Number(user.empresa_id);
      const hasCompanyLink = userEmpresaId === companyIdNum;
      
      // Verifica se o usuário NÃO é SUPERADMIN (incluir ADMIN, RH, GESTOR, FUNCIONARIO)
      // O role_name vem do nome do cargo
      const isNotSuperadmin = user.role_name !== 'Superadmin' && user.role_name !== 'SUPERADMIN';
      
      const passes = hasCompanyLink && isNotSuperadmin;
      
      if (!passes) {
        console.log('🔍 [funcionarios] Usuário filtrado:', {
          id: user.id,
          nome: user.nome,
          empresa_id: user.empresa_id,
          hasCompanyLink,
          role_name: user.role_name,
          isNotSuperadmin
        });
      }
      
      return passes;
    });

    console.log('🔍 [funcionarios] Usuários após filtro:', filtered.length);

    // Agrupar por usuário e pegar o primeiro departamento da empresa atual
    const employeesMap = new Map();
    
    filtered.forEach(user => {
      if (!employeesMap.has(user.id)) {
        employeesMap.set(user.id, {
          id: user.id,
          full_name: user.nome,
          nome: user.nome,
          email: user.email,
          phone: user.telefone,
          telefone: user.telefone,
          avatar_url: user.avatar_url,
          department: null,
          department_id: null
        });
      }
      
      const employee = employeesMap.get(user.id);
      
      // Adicionar departamento se for da empresa atual e ainda não tiver um
      if (!employee.department && user.department_company_id === companyId && user.department_title) {
        employee.department = user.department_title;
        employee.department_id = user.departamento_id;
      }
    });

    const employees = Array.from(employeesMap.values()).map(emp => ({
      ...emp,
      department: emp.department || 'Sem departamento',
      department_id: emp.department_id || null
    }));

    res.json(employees || []);

  } catch (error) {
    console.error('Erro ao listar funcionários:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// GET /api/employees/:id/department - Obter departamento do funcionário (USADO EM: goals.js)
router.get('/:id/department', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { companyId } = req.query;

    if (!companyId) {
      return res.status(400).json({ error: 'ID da empresa é obrigatório' });
    }

    // Verificar se o usuário pertence à empresa e qual é seu cargo (role)
    const [userCompany] = await db.query(
      `SELECT ue.empresa_id, ue.departamento_id, c.nome as role_name
       FROM usuarios_empresas ue
       LEFT JOIN cargos c ON ue.cargo_id = c.id
       WHERE ue.usuario_id = ? AND ue.empresa_id = ?`,
      [id, companyId]
    );

    if (!userCompany || userCompany.length === 0) {
      return res.status(404).json({ error: 'Usuário não pertence à empresa fornecida' });
    }

    // Se o usuário é SUPERADMIN (cargo Superadmin), não precisa estar em um departamento específico
    const roleName = userCompany[0].role_name;
    if (roleName === 'Superadmin' || roleName === 'SUPERADMIN') {
      return res.json({ department_id: null, role: 'SUPERADMIN' });
    }

    // Buscar departamento do usuário diretamente de usuarios_empresas
    const departamentoId = userCompany[0].departamento_id || null;

    res.json({ department_id: departamentoId });

  } catch (error) {
    console.error('Erro ao buscar departamento do funcionário:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

module.exports = router;

