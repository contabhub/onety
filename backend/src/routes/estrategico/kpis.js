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

// Funções auxiliares para conversão de mês
const mesesMap = {
  'Jan': 1, 'Fev': 2, 'Mar': 3, 'Abr': 4, 'Mai': 5, 'Jun': 6,
  'Jul': 7, 'Ago': 8, 'Set': 9, 'Out': 10, 'Nov': 11, 'Dez': 12
};

const mesesReverseMap = {
  1: 'Jan', 2: 'Fev', 3: 'Mar', 4: 'Abr', 5: 'Mai', 6: 'Jun',
  7: 'Jul', 8: 'Ago', 9: 'Set', 10: 'Out', 11: 'Nov', 12: 'Dez'
};

// Converter nome do mês (string) para número (1-12)
function mesStringToNumber(mes) {
  if (typeof mes === 'number') return mes; // Já é número
  if (typeof mes === 'string') {
    const num = mesesMap[mes];
    if (num) return num;
    // Tentar converter string numérica
    const parsed = parseInt(mes);
    if (!isNaN(parsed) && parsed >= 1 && parsed <= 12) return parsed;
  }
  throw new Error(`Mês inválido: ${mes}`);
}

// Converter número do mês (1-12) para nome (string)
function mesNumberToString(mes) {
  if (typeof mes === 'string') return mes; // Já é string
  if (typeof mes === 'number') {
    const str = mesesReverseMap[mes];
    if (str) return str;
  }
  throw new Error(`Mês inválido: ${mes}`);
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

    // Formatar resposta para compatibilidade com frontend
    const formatted = (kpiTypes || []).map(k => ({
      id: k.id,
      name: k.nome,
      description: k.descricao || null,
      unit_type: k.tipo_unidade,
      unit_symbol: k.unidade_simbolo,
      empresa_id: k.empresa_id
    }));

    res.json(formatted);

  } catch (error) {
    console.error('Erro ao listar tipos de KPI:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// POST /api/kpis/types - Criar tipo de KPI (USADO EM: KpiTypesManagerModal.js)
router.post('/types', verifyToken, async (req, res) => {
  try {
    const { name, description, unit_type, unit_symbol, companyId } = req.body;

    if (!name || !unit_type || !unit_symbol || !companyId) {
      return res.status(400).json({ error: 'Campos obrigatórios: name, unit_type, unit_symbol, companyId' });
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

    // Inserir tipo de KPI
    const [result] = await db.query(
      `INSERT INTO tipos_kpi (nome, descricao, tipo_unidade, unidade_simbolo, empresa_id) 
       VALUES (?, ?, ?, ?, ?)`,
      [name, description || null, unit_type, unit_symbol, companyId]
    );

    // Buscar tipo criado
    const [newType] = await db.query(
      'SELECT * FROM tipos_kpi WHERE id = ?',
      [result.insertId]
    );

    const formatted = newType[0] ? {
      id: newType[0].id,
      name: newType[0].nome,
      description: newType[0].descricao || null,
      unit_type: newType[0].tipo_unidade,
      unit_symbol: newType[0].unidade_simbolo,
      empresa_id: newType[0].empresa_id
    } : null;

    res.status(201).json(formatted);

  } catch (error) {
    console.error('Erro ao criar tipo de KPI:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// PUT /api/kpis/types/:id - Atualizar tipo de KPI (USADO EM: KpiTypesManagerModal.js)
router.put('/types/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, unit_type, unit_symbol, companyId } = req.body;

    if (!name || !unit_type || !unit_symbol || !companyId) {
      return res.status(400).json({ error: 'Campos obrigatórios: name, unit_type, unit_symbol, companyId' });
    }

    // Verificar se o tipo existe
    const [existingType] = await db.query(
      'SELECT empresa_id FROM tipos_kpi WHERE id = ?',
      [id]
    );

    if (!existingType || existingType.length === 0) {
      return res.status(404).json({ error: 'Tipo de KPI não encontrado' });
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

    // Verificar se o tipo pertence à empresa informada
    if (existingType[0].empresa_id != companyId) {
      return res.status(400).json({ error: 'Tipo de KPI não pertence a esta empresa' });
    }

    // Atualizar tipo de KPI
    await db.query(
      `UPDATE tipos_kpi SET nome = ?, descricao = ?, tipo_unidade = ?, unidade_simbolo = ? 
       WHERE id = ?`,
      [name, description || null, unit_type, unit_symbol, id]
    );

    // Buscar tipo atualizado
    const [updatedType] = await db.query(
      'SELECT * FROM tipos_kpi WHERE id = ?',
      [id]
    );

    const formatted = updatedType[0] ? {
      id: updatedType[0].id,
      name: updatedType[0].nome,
      description: updatedType[0].descricao || null,
      unit_type: updatedType[0].tipo_unidade,
      unit_symbol: updatedType[0].unidade_simbolo,
      empresa_id: updatedType[0].empresa_id
    } : null;

    res.json(formatted);

  } catch (error) {
    console.error('Erro ao atualizar tipo de KPI:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// DELETE /api/kpis/types/:id - Excluir tipo de KPI (USADO EM: KpiTypesManagerModal.js)
router.delete('/types/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar se o tipo existe
    const [existingType] = await db.query(
      'SELECT empresa_id FROM tipos_kpi WHERE id = ?',
      [id]
    );

    if (!existingType || existingType.length === 0) {
      return res.status(404).json({ error: 'Tipo de KPI não encontrado' });
    }

    // Verificar se o usuário tem acesso à empresa (exceto SUPERADMIN)
    if (req.user.role !== 'SUPERADMIN') {
      const [userAccess] = await db.query(
        'SELECT empresa_id FROM usuarios_empresas WHERE usuario_id = ? AND empresa_id = ?',
        [req.user.id, existingType[0].empresa_id]
      );

      if (!userAccess || userAccess.length === 0) {
        return res.status(403).json({ error: 'Acesso negado a esta empresa' });
      }
    }

    // Verificar se há KPIs usando este tipo
    const [kpisUsingType] = await db.query(
      'SELECT id FROM kpis WHERE tipo_kpi_id = ? LIMIT 1',
      [id]
    );

    if (kpisUsingType && kpisUsingType.length > 0) {
      return res.status(400).json({ 
        error: 'Não é possível excluir este tipo de KPI pois existem KPIs vinculados a ele' 
      });
    }

    // Excluir tipo de KPI
    await db.query('DELETE FROM tipos_kpi WHERE id = ?', [id]);

    res.json({ message: 'Tipo de KPI excluído com sucesso' });

  } catch (error) {
    console.error('Erro ao excluir tipo de KPI:', error);
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
      month: mesNumberToString(k.mes), // Converter número para string
      mes: mesNumberToString(k.mes), // Manter compatibilidade
      year: k.ano,
      target_value: k.valor_alvo,
      actual_value: k.valor_atual,
      kpi_type_id: k.kpi_type_id,
      department_id: k.department_id_field,
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

    // Converter mês de string para número
    const mesNumero = mesStringToNumber(month);

    // Verificar se já existe um KPI para este tipo, ano, mês E departamento
    let duplicateQuery = `
      SELECT id FROM kpis 
      WHERE empresa_id = ? AND tipo_kpi_id = ? AND ano = ? AND mes = ?
    `;
    const duplicateParams = [companyId, kpi_type_id, parseInt(year), mesNumero];

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
      [companyId, kpi_type_id, parseInt(year), mesNumero, parseFloat(target_value), parseFloat(actual_value), department_id || null]
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
      month: mesNumberToString(newKpi[0].mes), // Converter número para string
      mes: mesNumberToString(newKpi[0].mes), // Manter compatibilidade
      year: newKpi[0].ano,
      target_value: newKpi[0].valor_alvo,
      actual_value: newKpi[0].valor_atual,
      kpi_type_id: newKpi[0].kpi_type_id,
      department_id: newKpi[0].department_id_field,
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

    // Converter mês de string para número
    const mesNumero = mesStringToNumber(month);

    // Verificar se já existe outro KPI para este tipo, ano, mês E departamento (excluindo o atual)
    let duplicateQuery = `
      SELECT id FROM kpis 
      WHERE empresa_id = ? AND tipo_kpi_id = ? AND ano = ? AND mes = ? AND id != ?
    `;
    const duplicateParams = [existingKpi[0].empresa_id, kpi_type_id, parseInt(year), mesNumero, id];

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
      [kpi_type_id, parseInt(year), mesNumero, parseFloat(target_value), parseFloat(actual_value), department_id || null, id]
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
      month: mesNumberToString(updatedKpi[0].mes), // Converter número para string
      mes: mesNumberToString(updatedKpi[0].mes), // Manter compatibilidade
      year: updatedKpi[0].ano,
      target_value: updatedKpi[0].valor_alvo,
      actual_value: updatedKpi[0].valor_atual,
      kpi_type_id: updatedKpi[0].kpi_type_id,
      department_id: updatedKpi[0].department_id_field,
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
router.patch('/:id/link-department', verifyToken, async (req, res) => {
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
      month: mesNumberToString(updatedKpi[0].mes), // Converter número para string
      mes: mesNumberToString(updatedKpi[0].mes), // Manter compatibilidade
      year: updatedKpi[0].ano,
      target_value: updatedKpi[0].valor_alvo,
      actual_value: updatedKpi[0].valor_atual,
      kpi_type_id: updatedKpi[0].kpi_type_id,
      department_id: updatedKpi[0].department_id_field,
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

