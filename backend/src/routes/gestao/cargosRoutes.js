const express = require('express');
const router = express.Router();
const db = require('../../config/database');
const autenticarToken = require('../../middlewares/auth');
const { verificarPermissao } = require('../../middlewares/permissao');

/**
 * Criar novo cargo
 */
router.post('/', autenticarToken, verificarPermissao('cargos.criar'), async (req, res) => {
  try {
    const { nome, descricao, permissoes } = req.body;
    const empresaId = req.user && (req.user.EmpresaId || req.user.empresaId);

    if (!nome || !empresaId) {
      return res.status(400).json({ error: 'Nome do cargo e empresaId são obrigatórios.' });
    }

    // ✅ Permissões padrão incluindo tarefas
    const permissoesPadrao = {
      tarefas: ["visualizar", "criar"], // ✅ Permissão para criar tarefas
      clientes: ["visualizar"], // ✅ Permissão básica para visualizar clientes
      ...permissoes // ✅ Permissões customizadas sobrescrevem as padrão
    };

    const [result] = await db.query(
      `INSERT INTO cargos (nome, descricao, permissoes, empresa_id) VALUES (?, ?, ?, ?)`,
      [nome, descricao || '', JSON.stringify(permissoesPadrao), empresaId]
    );

    res.status(201).json({ id: result.insertId, message: 'Cargo criado com sucesso!' });
  } catch (error) {
    console.error('Erro ao criar cargo:', error);
    res.status(500).json({ error: 'Erro interno ao criar o cargo.' });
  }
});

/**
 * Listar todos os cargos da empresa
 */
router.get('/', autenticarToken, verificarPermissao('cargos.visualizar'), async (req, res) => {
  try {
    let empresaId = req.user && (req.user.EmpresaId || req.user.empresaId);
    const permissoes = (req.user && req.user.permissoes) || {};
    // Se for superadmin e mandou empresaId na query, usa ele
    if (permissoes.adm && permissoes.adm.includes('superadmin') && req.query.empresaId) {
      empresaId = req.query.empresaId;
    }
    if (!empresaId) {
      return res.status(400).json({ error: 'Empresa não informada.' });
    }
    const [cargos] = await db.query(
      `SELECT id, nome, descricao, permissoes FROM cargos WHERE empresa_id = ? AND LOWER(nome) NOT LIKE '%superadmin%'`,
      [empresaId]
    );
    res.json(cargos.map(c => ({
      ...c,
      permissoes: typeof c.permissoes === 'string' ? JSON.parse(c.permissoes) : (c.permissoes || {})
    })));
  } catch (error) {
    console.error('Erro ao listar cargos:', error);
    res.status(500).json({ error: 'Erro interno ao listar os cargos.' });
  }
});

/**
 * Listar cargos de uma empresa específica (rota explícita)
 * - Superadmin pode acessar qualquer empresa
 * - Demais usuários só podem acessar a própria empresa do token
 */
router.get('/empresa/:empresaId', autenticarToken, verificarPermissao('cargos.visualizar'), async (req, res) => {
  try {
    const { empresaId } = req.params;
    const userEmpresaId = req.user && (req.user.EmpresaId || req.user.empresaId);
    const permissoes = (req.user && req.user.permissoes) || {};

    const isSuperadmin = Array.isArray(permissoes?.adm) && permissoes.adm.includes('superadmin');
    if (!isSuperadmin && String(empresaId) !== String(userEmpresaId)) {
      return res.status(403).json({ error: 'Acesso negado para a empresa informada.' });
    }

    const [cargos] = await db.query(
      `SELECT id, nome, descricao, permissoes FROM cargos WHERE empresa_id = ? AND LOWER(nome) NOT LIKE '%superadmin%'`,
      [empresaId]
    );
    res.json(cargos.map(c => ({
      ...c,
      permissoes: typeof c.permissoes === 'string' ? JSON.parse(c.permissoes) : (c.permissoes || {})
    })));
  } catch (error) {
    console.error('Erro ao listar cargos por empresa:', error);
    res.status(500).json({ error: 'Erro interno ao listar os cargos.' });
  }
});

/**
 * Detalhar um cargo por ID
 */
router.get('/:id', autenticarToken, verificarPermissao('cargos.visualizar'), async (req, res) => {
  try {
    const { id } = req.params;
    const empresaId = req.user && (req.user.EmpresaId || req.user.empresaId);

    const [cargos] = await db.query(
      `SELECT * FROM cargos WHERE id = ? AND empresa_id = ?`,
      [id, empresaId]
    );

    
    if (cargos.length === 0) {
      return res.status(404).json({ error: 'Cargo não encontrado.' });
    }

    const cargo = cargos[0];
    cargo.permissoes = typeof cargo.permissoes === 'string' ? JSON.parse(cargo.permissoes) : (cargo.permissoes || {});
    res.json(cargo);
  } catch (error) {
    console.error('Erro ao buscar cargo:', error);
    res.status(500).json({ error: 'Erro interno ao buscar cargo.' });
  }
});

/**
 * Atualizar um cargo
 */
router.put('/:id', autenticarToken, verificarPermissao('cargos.editar'), async (req, res) => {
  try {
    const { id } = req.params;
    const { nome, descricao, permissoes } = req.body;
    const empresaId = req.user && (req.user.EmpresaId || req.user.empresaId);
    const permissoesUser = (req.user && req.user.permissoes) || {};
    const isSuperadmin = Array.isArray(permissoesUser?.adm) && permissoesUser.adm.includes('superadmin');

    // ✅ Garantir que permissões básicas estejam sempre presentes
    const permissoesAtualizadas = {
      tarefas: ["visualizar", "criar"], // ✅ Sempre permitir criar tarefas
      clientes: ["visualizar"], // ✅ Sempre permitir visualizar clientes
      ...permissoes // ✅ Permissões customizadas sobrescrevem as básicas
    };

    let result;
    if (isSuperadmin) {
      // Superadmin pode atualizar independentemente da empresa
      [result] = await db.query(
        `UPDATE cargos SET nome = ?, descricao = ?, permissoes = ?, atualizado_em = NOW() WHERE id = ?`,
        [nome, descricao || '', JSON.stringify(permissoesAtualizadas), id]
      );
    } else {
      [result] = await db.query(
        `UPDATE cargos SET nome = ?, descricao = ?, permissoes = ?, atualizado_em = NOW() WHERE id = ? AND empresa_id = ?`,
        [nome, descricao || '', JSON.stringify(permissoesAtualizadas), id, empresaId]
      );
    }

    if (!result || result.affectedRows === 0) {
      return res.status(404).json({ error: 'Cargo não encontrado para a empresa informada.' });
    }

    res.json({ message: 'Cargo atualizado com sucesso!' });
  } catch (error) {
    console.error('Erro ao atualizar cargo:', error);
    res.status(500).json({ error: 'Erro interno ao atualizar cargo.' });
  }
});

/**
 * Deletar um cargo
 */
router.delete('/:id', autenticarToken, verificarPermissao('cargos.excluir'), async (req, res) => {
  try {
    const { id } = req.params;
    const empresaId = req.user && (req.user.EmpresaId || req.user.empresaId);

    const [relacoes] = await db.query(
      `SELECT id FROM usuarios_empresas WHERE cargo_id = ? LIMIT 1`,
      [id]
    );

    if (relacoes.length > 0) {
      return res.status(400).json({ error: 'Não é possível deletar: existem usuários vinculados a este cargo.' });
    }

    await db.query(`DELETE FROM cargos WHERE id = ? AND empresa_id = ?`, [id, empresaId]);
    res.json({ message: 'Cargo deletado com sucesso.' });
  } catch (error) {
    console.error('Erro ao deletar cargo:', error);
    res.status(500).json({ error: 'Erro interno ao deletar cargo.' });
  }
});

module.exports = router;
