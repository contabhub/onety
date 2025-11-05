const express = require('express');
const db = require('../../config/database.js');
const verifyToken = require('../../middlewares/auth');

const router = express.Router();

// GET /api/organization - Listar organograma da empresa (USADO EM: organization.js, goals.js)
router.get('/', verifyToken, async (req, res) => {
  try {
    const { companyId } = req.query;

    if (!companyId) {
      return res.status(400).json({ error: 'ID da empresa é obrigatório' });
    }

    // SUPERADMIN, ADMIN e RH têm acesso TOTAL a tudo
    if (req.user.role !== 'SUPERADMIN' && req.user.role !== 'ADMIN' && req.user.role !== 'RH') {
      // Verificar se o usuário tem acesso à empresa
      const [userAccess] = await db.query(
        'SELECT empresa_id FROM usuarios_empresas WHERE usuario_id = ? AND empresa_id = ?',
        [req.user.id, companyId]
      );

      if (!userAccess || userAccess.length === 0) {
        return res.status(403).json({ error: 'Acesso negado a esta empresa' });
      }
    }

    // Buscar organograma da empresa
    const [data] = await db.query(
      `SELECT d.*, 
        u.id as manager_id_field,
        u.nome as manager_nome,
        u.avatar_url as manager_avatar_url
      FROM departamentos d
      LEFT JOIN usuarios u ON d.responsavel_id = u.id
      WHERE d.empresa_id = ? AND d.status = 'ativo'
      ORDER BY d.nivel ASC`,
      [companyId]
    );

    // Formatar resposta
    const formatted = (data || []).map(item => ({
      ...item,
      title: item.nome,
      nome: item.nome,
      description: item.descricao,
      descricao: item.descricao,
      manager_id: item.responsavel_id,
      responsavel_id: item.responsavel_id,
      company_id: item.empresa_id,
      empresa_id: item.empresa_id,
      level: item.nivel,
      nivel: item.nivel,
      manager: item.manager_id_field ? {
        id: item.manager_id_field,
        full_name: item.manager_nome,
        nome: item.manager_nome,
        avatar_url: item.manager_avatar_url
      } : null
    }));

    res.json(formatted);

  } catch (error) {
    console.error('Erro ao listar organograma:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// DELETE /api/organization/:id - Deletar departamento (USADO EM: organization.js)
router.delete('/:id', verifyToken,  async (req, res) => {
  try {
    const { id } = req.params;
    const { companyId, deleteTasks, transferTasks, transferToDepartment } = req.query;

    if (!companyId) {
      return res.status(400).json({ error: 'ID da empresa é obrigatório' });
    }

    // Buscar departamento para verificar se é raiz
    const [department] = await db.query(
      'SELECT * FROM departamentos WHERE id = ? AND empresa_id = ?',
      [id, companyId]
    );

    if (!department || department.length === 0) {
      return res.status(404).json({ error: 'Departamento não encontrado' });
    }

    const dept = department[0];

    // BLOQUEIO: Não permitir exclusão de departamento raiz
    if (dept.parent_id === null) {
      return res.status(400).json({ 
        error: 'Departamento raiz não pode ser excluído',
        code: 'ROOT_DEPARTMENT_CANNOT_BE_DELETED'
      });
    }

    // Buscar departamentos filhos para reorganização
    const [childDepartments] = await db.query(
      'SELECT id, nome FROM departamentos WHERE parent_id = ? AND empresa_id = ? AND status = \'ativo\'',
      [id, companyId]
    );

    // Reorganizar filhos: mover para o pai do departamento sendo excluído
    if (childDepartments && childDepartments.length > 0) {
      await db.query(
        'UPDATE departamentos SET parent_id = ? WHERE parent_id = ? AND empresa_id = ?',
        [dept.parent_id, id, companyId]
      );
    }

    // Desfazer vínculos de membros (atualizar usuarios_empresas para remover departamento_id)
    await db.query(
      'UPDATE usuarios_empresas SET departamento_id = NULL WHERE departamento_id = ?',
      [id]
    );

    // Tratar tarefas conforme opção selecionada
    let tasksResult = { movedTasks: false, deletedTasks: false, transferredTasks: false };
    
    try {
      // Verificar se existem tarefas com este departamento_id
      const [tasksToHandle] = await db.query(
        'SELECT id FROM tarefas WHERE departamento_id = ?',
        [id]
      );

      if (tasksToHandle && tasksToHandle.length > 0) {
        if (deleteTasks === 'true') {
          // Deletar tarefas
          await db.query('DELETE FROM tarefas WHERE departamento_id = ?', [id]);
          tasksResult.deletedTasks = true;
        } else if (transferTasks === 'true' && transferToDepartment) {
          // Transferir tarefas para departamento específico
          await db.query(
            'UPDATE tarefas SET departamento_id = ? WHERE departamento_id = ?',
            [transferToDepartment, id]
          );
          tasksResult.transferredTasks = true;
        } else {
          // Fallback: mover para departamento pai
          await db.query(
            'UPDATE tarefas SET departamento_id = ? WHERE departamento_id = ?',
            [dept.parent_id, id]
          );
          tasksResult.movedTasks = true;
        }
      }
    } catch (tasksHandleError) {
      console.error('Erro ao processar tarefas:', tasksHandleError);
    }

    // Tratar metas departamentais (não pode ser NULL, então mover para departamento pai ou deletar)
    try {
      const [goalsToUpdate] = await db.query(
        'SELECT id FROM metas_departamentais WHERE departamento_id = ?',
        [id]
      );

      if (goalsToUpdate && goalsToUpdate.length > 0) {
        // Mover metas para o departamento pai (se existir)
        if (dept.parent_id) {
          await db.query(
            'UPDATE metas_departamentais SET departamento_id = ? WHERE departamento_id = ?',
            [dept.parent_id, id]
          );
        } else {
          // Se não tem pai, deletar as metas (não pode ser NULL)
          await db.query(
            'DELETE FROM metas_departamentais WHERE departamento_id = ?',
            [id]
          );
        }
      }
    } catch (goalsUpdateError) {
      console.error('Erro ao processar metas departamentais:', goalsUpdateError);
    }

    // Desfazer vínculos de KPIs (pode ser NULL, então apenas desvincular)
    try {
      await db.query(
        'UPDATE kpis SET departamento_id = NULL WHERE departamento_id = ?',
        [id]
      );
    } catch (kpisUpdateError) {
      console.error('Erro ao desvincular KPIs:', kpisUpdateError);
    }

    // Remover departamento (soft delete - marcar como inativo)
    await db.query(
      'UPDATE departamentos SET status = \'inativo\' WHERE id = ? AND empresa_id = ?',
      [id, companyId]
    );

    res.json({
      message: 'Departamento excluído com sucesso',
      reorganizedChildren: childDepartments?.length || 0,
      movedTasks: tasksResult.movedTasks,
      deletedTasks: tasksResult.deletedTasks,
      transferredTasks: tasksResult.transferredTasks,
      unlinkedMembers: true
    });

  } catch (error) {
    console.error('Erro ao deletar departamento:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

module.exports = router;

