const express = require('express');
const db = require('../../config/database.js');
const verifyToken = require('../../middlewares/auth');

const router = express.Router();

// Função auxiliar para verificar se usuário é líder de departamento
async function isUserLeaderOfDepartment(userId, departmentId) {
  const [result] = await db.query(
    'SELECT id FROM departamentos WHERE id = ? AND responsavel_id = ?',
    [departmentId, userId]
  );
  return result && result.length > 0;
}

// GET /api/kpis/types - Listar tipos de KPI (USADO EM: kpis.js)
router.get('/types', verifyToken, async (req, res) => {
  try {
    const { companyId } = req.query;

    if (!companyId) {
      return res.status(400).json({ error: 'ID da empresa é obrigatório' });
    }

    // Verificar se o usuário tem acesso à empresa (exceto SUPERADMIN)
    if (req.user.role !== 'SUPERADMIN') {
      const [userAccess] = await db.query(
        'SELECT empresa_id FROM usuarios_empresas WHERE usuario_id = ? AND empresa_id = ?',
        [req.user.id, companyId]
      );

      if (!userAccess || userAccess.length === 0) {
        return res.status(403).json({ error: 'Acesso negado a esta empresa' });
      }
    }

    // Buscar apenas tipos da empresa específica
    const [kpiTypes] = await db.query(
      'SELECT * FROM tipos_kpi WHERE empresa_id = ? ORDER BY nome',
      [companyId]
    );

    res.json(kpiTypes || []);

  } catch (error) {
    console.error('Erro ao listar tipos de KPI:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// GET /api/kpis - Listar KPIs (USADO EM: kpis.js)
router.get('/', verifyToken, async (req, res) => {
  try {
    const { companyId, year, kpi_type_id, department_id } = req.query;

    if (!companyId) {
      return res.status(400).json({ error: 'ID da empresa é obrigatório' });
    }

    // Verificar se o usuário tem acesso à empresa (exceto SUPERADMIN)
    if (req.user.role !== 'SUPERADMIN') {
      const [userAccess] = await db.query(
        'SELECT empresa_id FROM usuarios_empresas WHERE usuario_id = ? AND empresa_id = ?',
        [req.user.id, companyId]
      );

      if (!userAccess || userAccess.length === 0) {
        return res.status(403).json({ error: 'Acesso negado a esta empresa' });
      }
    }

    let query = `
      SELECT k.*, 
        kt.id as kpi_type_id, 
        kt.nome as kpi_type_name, 
        kt.tipo_unidade as unit_type, 
        kt.unidade_simbolo as unit_symbol,
        d.id as department_id_field,
        d.nome as department_title
      FROM kpis k
      LEFT JOIN tipos_kpi kt ON k.tipo_kpi_id = kt.id
      LEFT JOIN departamentos d ON k.departamento_id = d.id
      WHERE k.empresa_id = ?
    `;
    const params = [companyId];

    if (year) {
      query += ' AND k.ano = ?';
      params.push(parseInt(year));
    }

    if (kpi_type_id) {
      query += ' AND k.tipo_kpi_id = ?';
      params.push(kpi_type_id);
    }

    if (department_id) {
      query += ' AND k.departamento_id = ?';
      params.push(department_id);
    }

    query += ' ORDER BY k.ano DESC, k.mes';

    const [kpis] = await db.query(query, params);

    // Formatar resposta
    const formatted = (kpis || []).map(k => ({
      ...k,
      kpi_types: k.kpi_type_id ? {
        id: k.kpi_type_id,
        name: k.kpi_type_name,
        unit_type: k.unit_type,
        unit_symbol: k.unit_symbol
      } : null,
      department: k.department_id_field ? {
        id: k.department_id_field,
        title: k.department_title
      } : null
    }));

    res.json(formatted);

  } catch (error) {
    console.error('Erro ao buscar KPIs:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// POST /api/kpis - Criar KPI (USADO EM: kpis.js)
router.post('/', verifyToken,  async (req, res) => {
  try {
    const { companyId, kpi_type_id, year, month, target_value, actual_value, department_id } = req.body;

    if (!companyId || !kpi_type_id || !year || !month || target_value === undefined || actual_value === undefined) {
      return res.status(400).json({ error: 'Todos os campos são obrigatórios' });
    }

    // Verificar permissões específicas do GESTOR
    if (req.user.role === 'GESTOR') {
      if (!department_id) {
        return res.status(403).json({ error: 'Gestor não pode criar KPIs globais' });
      }
      
      const isLeader = await isUserLeaderOfDepartment(req.user.id, department_id);
      if (!isLeader) {
        return res.status(403).json({ error: 'Você só pode criar KPIs nos departamentos onde é líder' });
      }
    }

    // Se department_id foi fornecido, verificar se pertence à mesma empresa
    if (department_id) {
      const [department] = await db.query(
        'SELECT id, empresa_id FROM departamentos WHERE id = ? AND empresa_id = ?',
        [department_id, companyId]
      );

      if (!department || department.length === 0) {
        return res.status(400).json({ error: 'Departamento não encontrado ou não pertence a esta empresa' });
      }
    }

    // Verificar se já existe um KPI para este tipo, ano, mês E departamento
    let duplicateQuery = `
      SELECT id FROM kpis 
      WHERE empresa_id = ? AND tipo_kpi_id = ? AND ano = ? AND mes = ?
    `;
    const duplicateParams = [companyId, kpi_type_id, parseInt(year), month];

    if (department_id) {
      duplicateQuery += ' AND departamento_id = ?';
      duplicateParams.push(department_id);
    } else {
      duplicateQuery += ' AND departamento_id IS NULL';
    }

    const [existingKpis] = await db.query(duplicateQuery, duplicateParams);

    if (existingKpis && existingKpis.length > 0) {
      return res.status(400).json({ 
        error: department_id 
          ? 'Já existe um KPI para este tipo, ano, mês e departamento' 
          : 'Já existe um KPI para este tipo, ano e mês sem departamento'
      });
    }

    // Inserir KPI
    const [result] = await db.query(
      `INSERT INTO kpis (empresa_id, tipo_kpi_id, ano, mes, valor_alvo, valor_atual, departamento_id) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [companyId, kpi_type_id, parseInt(year), month, parseFloat(target_value), parseFloat(actual_value), department_id || null]
    );

    // Buscar KPI criado com joins
    const [newKpi] = await db.query(
      `SELECT k.*, 
        kt.id as kpi_type_id, 
        kt.nome as kpi_type_name, 
        kt.tipo_unidade as unit_type, 
        kt.unidade_simbolo as unit_symbol,
        d.id as department_id_field,
        d.nome as department_title
      FROM kpis k
      LEFT JOIN tipos_kpi kt ON k.tipo_kpi_id = kt.id
      LEFT JOIN departamentos d ON k.departamento_id = d.id
      WHERE k.id = ?`,
      [result.insertId]
    );

    const formatted = newKpi[0] ? {
      ...newKpi[0],
      kpi_types: newKpi[0].kpi_type_id ? {
        id: newKpi[0].kpi_type_id,
        name: newKpi[0].kpi_type_name,
        unit_type: newKpi[0].unit_type,
        unit_symbol: newKpi[0].unit_symbol
      } : null,
      department: newKpi[0].department_id_field ? {
        id: newKpi[0].department_id_field,
        title: newKpi[0].department_title
      } : null
    } : null;

    res.status(201).json(formatted);

  } catch (error) {
    console.error('Erro ao criar KPI:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// PUT /api/kpis/:id - Atualizar KPI (USADO EM: kpis.js)
router.put('/:id', verifyToken,  async (req, res) => {
  try {
    const { id } = req.params;
    const { kpi_type_id, year, month, target_value, actual_value, department_id } = req.body;

    if (!kpi_type_id || !year || !month || target_value === undefined || actual_value === undefined) {
      return res.status(400).json({ error: 'Todos os campos são obrigatórios' });
    }

    // Verificar se o KPI existe e se o usuário tem acesso
    const [existingKpi] = await db.query(
      'SELECT empresa_id FROM kpis WHERE id = ?',
      [id]
    );

    if (!existingKpi || existingKpi.length === 0) {
      return res.status(404).json({ error: 'KPI não encontrado' });
    }

    // Verificar permissões específicas do GESTOR
    if (req.user.role === 'GESTOR') {
      if (!department_id) {
        return res.status(403).json({ error: 'Gestor não pode editar KPIs globais' });
      }
      const isLeader = await isUserLeaderOfDepartment(req.user.id, department_id);
      if (!isLeader) {
        return res.status(403).json({ error: 'Você só pode editar KPIs nos departamentos onde é líder' });
      }
    }

    // Se department_id foi fornecido, verificar se pertence à mesma empresa
    if (department_id) {
      const [department] = await db.query(
        'SELECT id, empresa_id FROM departamentos WHERE id = ? AND empresa_id = ?',
        [department_id, existingKpi[0].empresa_id]
      );

      if (!department || department.length === 0) {
        return res.status(400).json({ error: 'Departamento não encontrado ou não pertence a esta empresa' });
      }
    }

    // Verificar se já existe outro KPI para este tipo, ano, mês E departamento (excluindo o atual)
    let duplicateQuery = `
      SELECT id FROM kpis 
      WHERE empresa_id = ? AND tipo_kpi_id = ? AND ano = ? AND mes = ? AND id != ?
    `;
    const duplicateParams = [existingKpi[0].empresa_id, kpi_type_id, parseInt(year), month, id];

    if (department_id) {
      duplicateQuery += ' AND departamento_id = ?';
      duplicateParams.push(department_id);
    } else {
      duplicateQuery += ' AND departamento_id IS NULL';
    }

    const [duplicateKpis] = await db.query(duplicateQuery, duplicateParams);

    if (duplicateKpis && duplicateKpis.length > 0) {
      return res.status(400).json({ 
        error: department_id 
          ? 'Já existe um KPI para este tipo, ano, mês e departamento' 
          : 'Já existe um KPI para este tipo, ano e mês sem departamento'
      });
    }

    // Atualizar KPI
    await db.query(
      `UPDATE kpis SET tipo_kpi_id = ?, ano = ?, mes = ?, valor_alvo = ?, valor_atual = ?, departamento_id = ? 
       WHERE id = ?`,
      [kpi_type_id, parseInt(year), month, parseFloat(target_value), parseFloat(actual_value), department_id || null, id]
    );

    // Buscar KPI atualizado com joins
    const [updatedKpi] = await db.query(
      `SELECT k.*, 
        kt.id as kpi_type_id, 
        kt.nome as kpi_type_name, 
        kt.tipo_unidade as unit_type, 
        kt.unidade_simbolo as unit_symbol,
        d.id as department_id_field,
        d.nome as department_title
      FROM kpis k
      LEFT JOIN tipos_kpi kt ON k.tipo_kpi_id = kt.id
      LEFT JOIN departamentos d ON k.departamento_id = d.id
      WHERE k.id = ?`,
      [id]
    );

    const formatted = updatedKpi[0] ? {
      ...updatedKpi[0],
      kpi_types: updatedKpi[0].kpi_type_id ? {
        id: updatedKpi[0].kpi_type_id,
        name: updatedKpi[0].kpi_type_name,
        unit_type: updatedKpi[0].unit_type,
        unit_symbol: updatedKpi[0].unit_symbol
      } : null,
      department: updatedKpi[0].department_id_field ? {
        id: updatedKpi[0].department_id_field,
        title: updatedKpi[0].department_title
      } : null
    } : null;

    res.json(formatted);

  } catch (error) {
    console.error('Erro ao atualizar KPI:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// DELETE /api/kpis/:id - Excluir KPI (USADO EM: kpis.js)
router.delete('/:id', verifyToken,  async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar se o KPI existe e se o usuário tem acesso
    const [existingKpi] = await db.query(
      'SELECT empresa_id FROM kpis WHERE id = ?',
      [id]
    );

    if (!existingKpi || existingKpi.length === 0) {
      return res.status(404).json({ error: 'KPI não encontrado' });
    }

    // Verificar se o usuário tem acesso à empresa (exceto SUPERADMIN)
    if (req.user.role !== 'SUPERADMIN') {
      const [userAccess] = await db.query(
        'SELECT empresa_id FROM usuarios_empresas WHERE usuario_id = ? AND empresa_id = ?',
        [req.user.id, existingKpi[0].empresa_id]
      );

      if (!userAccess || userAccess.length === 0) {
        return res.status(403).json({ error: 'Acesso negado a esta empresa' });
      }
    }

    await db.query('DELETE FROM kpis WHERE id = ?', [id]);

    res.json({ message: 'KPI excluído com sucesso' });

  } catch (error) {
    console.error('Erro ao excluir KPI:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// PATCH /api/kpis/:id/link-department - Vincular/Desvincular departamento a um KPI (USADO EM: kpis.js)
router.patch('/:id/link-department', async (req, res) => {
  try {
    const { id } = req.params;
    const { department_id } = req.body;

    // department_id pode ser null para desvincular
    if (department_id === undefined) {
      return res.status(400).json({ error: 'Campo department_id é obrigatório (pode ser null para desvincular)' });
    }

    // Verificar se o KPI existe
    const [existingKpi] = await db.query(
      'SELECT id, empresa_id FROM kpis WHERE id = ?',
      [id]
    );

    if (!existingKpi || existingKpi.length === 0) {
      return res.status(404).json({ error: 'KPI não encontrado' });
    }

    // Verificar se o usuário tem acesso à empresa (exceto SUPERADMIN)
    if (req.user.role !== 'SUPERADMIN') {
      const [userAccess] = await db.query(
        'SELECT empresa_id FROM usuarios_empresas WHERE usuario_id = ? AND empresa_id = ?',
        [req.user.id, existingKpi[0].empresa_id]
      );

      if (!userAccess || userAccess.length === 0) {
        return res.status(403).json({ error: 'Acesso negado a esta empresa' });
      }
    }

    // Se department_id não for null, verificar se o departamento existe e pertence à mesma empresa
    if (department_id) {
      const [department] = await db.query(
        'SELECT id, empresa_id, nome FROM departamentos WHERE id = ? AND empresa_id = ?',
        [department_id, existingKpi[0].empresa_id]
      );

      if (!department || department.length === 0) {
        return res.status(400).json({ error: 'Departamento não encontrado ou não pertence a esta empresa' });
      }
    }

    // Atualizar o KPI com o department_id
    await db.query(
      'UPDATE kpis SET departamento_id = ? WHERE id = ?',
      [department_id, id]
    );

    // Buscar KPI atualizado com joins
    const [updatedKpi] = await db.query(
      `SELECT k.*, 
        kt.id as kpi_type_id, 
        kt.nome as kpi_type_name, 
        kt.tipo_unidade as unit_type, 
        kt.unidade_simbolo as unit_symbol,
        d.id as department_id_field,
        d.nome as department_title
      FROM kpis k
      LEFT JOIN tipos_kpi kt ON k.tipo_kpi_id = kt.id
      LEFT JOIN departamentos d ON k.departamento_id = d.id
      WHERE k.id = ?`,
      [id]
    );

    const formatted = updatedKpi[0] ? {
      ...updatedKpi[0],
      kpi_types: updatedKpi[0].kpi_type_id ? {
        id: updatedKpi[0].kpi_type_id,
        name: updatedKpi[0].kpi_type_name,
        unit_type: updatedKpi[0].unit_type,
        unit_symbol: updatedKpi[0].unit_symbol
      } : null,
      department: updatedKpi[0].department_id_field ? {
        id: updatedKpi[0].department_id_field,
        title: updatedKpi[0].department_title
      } : null
    } : null;

    res.json(formatted);

  } catch (error) {
    console.error('Erro ao vincular departamento ao KPI:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

module.exports = router;

