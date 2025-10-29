const express = require('express');
const router = express.Router();
const db = require('../../config/database');
const { autenticarToken } = require('../../middlewares/auth');
const { verificarPermissao } = require('../../middlewares/permissaoMiddleware');

// =====================================================
// 📋 ROTAS PARA CAMPOS ADICIONAIS
// =====================================================

/**
 * 📌 Listar campos adicionais da empresa
 */
router.get('/:empresaId', autenticarToken, verificarPermissao('clientes.visualizar'), async (req, res) => {
  try {
    const { empresaId } = req.params;
    
    const [campos] = await db.query(
      `SELECT * FROM campos_adicionais 
       WHERE empresaId = ? AND ativo = true 
       ORDER BY ordem ASC, nome ASC`,
      [empresaId]
    );

    res.json(campos);
  } catch (error) {
    console.error('❌ Erro ao buscar campos adicionais:', error);
    res.status(500).json({ error: 'Erro ao buscar campos adicionais.' });
  }
});

/**
 * 📌 Criar novo campo adicional
 */
router.post('/', autenticarToken, async (req, res) => {
  try {
    const { empresaId, nome, tipo, opcoes, obrigatorio, ordem } = req.body;

    if (!empresaId || !nome) {
      return res.status(400).json({ error: 'EmpresaId e nome são obrigatórios.' });
    }

    // Verificar se já existe campo com esse nome na empresa
    const [existe] = await db.query(
      'SELECT id FROM campos_adicionais WHERE empresaId = ? AND nome = ? AND ativo = true',
      [empresaId, nome]
    );

    if (existe.length > 0) {
      return res.status(409).json({ error: 'Já existe um campo com esse nome.' });
    }

    // Buscar próxima ordem se não informada
    let proximaOrdem = ordem;
    if (!proximaOrdem) {
      const [ultimaOrdem] = await db.query(
        'SELECT MAX(ordem) as max_ordem FROM campos_adicionais WHERE empresaId = ?',
        [empresaId]
      );
      proximaOrdem = (ultimaOrdem[0]?.max_ordem || 0) + 1;
    }

    const [resultado] = await db.query(
      `INSERT INTO campos_adicionais 
       (empresaId, nome, tipo, opcoes, obrigatorio, ordem) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [empresaId, nome, tipo || 'texto', opcoes ? JSON.stringify(opcoes) : null, obrigatorio || false, proximaOrdem]
    );

    res.status(201).json({ 
      success: true, 
      campoId: resultado.insertId, 
      message: 'Campo adicional criado com sucesso!' 
    });
  } catch (error) {
    console.error('❌ Erro ao criar campo adicional:', error);
    res.status(500).json({ error: 'Erro ao criar campo adicional.' });
  }
});

/**
 * 📌 Atualizar campo adicional
 */
router.put('/:id', autenticarToken, verificarPermissao('clientes.editar'), async (req, res) => {
  try {
    const { id } = req.params;
    const { nome, tipo, opcoes, obrigatorio, ordem, ativo } = req.body;

    if (!nome) {
      return res.status(400).json({ error: 'Nome é obrigatório.' });
    }

    // Buscar campo atual para verificar empresa
    const [campoAtual] = await db.query(
      'SELECT empresaId FROM campos_adicionais WHERE id = ?',
      [id]
    );

    if (campoAtual.length === 0) {
      return res.status(404).json({ error: 'Campo não encontrado.' });
    }

    // Verificar se já existe outro campo com esse nome na mesma empresa
    const [existe] = await db.query(
      'SELECT id FROM campos_adicionais WHERE empresaId = ? AND nome = ? AND id <> ? AND ativo = true',
      [campoAtual[0].empresaId, nome, id]
    );

    if (existe.length > 0) {
      return res.status(409).json({ error: 'Já existe um campo com esse nome.' });
    }

    const [resultado] = await db.query(
      `UPDATE campos_adicionais 
       SET nome = ?, tipo = ?, opcoes = ?, obrigatorio = ?, ordem = ?, ativo = ?
       WHERE id = ?`,
      [nome, tipo, opcoes ? JSON.stringify(opcoes) : null, obrigatorio, ordem, ativo, id]
    );

    if (resultado.affectedRows === 0) {
      return res.status(404).json({ error: 'Campo não encontrado.' });
    }

    res.json({ success: true, message: 'Campo adicional atualizado com sucesso!' });
  } catch (error) {
    console.error('❌ Erro ao atualizar campo adicional:', error);
    res.status(500).json({ error: 'Erro ao atualizar campo adicional.' });
  }
});

/**
 * 📌 Excluir campo adicional (soft delete)
 */
router.delete('/:id', autenticarToken, verificarPermissao('clientes.editar'), async (req, res) => {
  try {
    const { id } = req.params;

    const [resultado] = await db.query(
      'UPDATE campos_adicionais SET ativo = false WHERE id = ?',
      [id]
    );

    if (resultado.affectedRows === 0) {
      return res.status(404).json({ error: 'Campo não encontrado.' });
    }

    res.json({ success: true, message: 'Campo adicional excluído com sucesso!' });
  } catch (error) {
    console.error('❌ Erro ao excluir campo adicional:', error);
    res.status(500).json({ error: 'Erro ao excluir campo adicional.' });
  }
});

/**
 * 📌 Reordenar campos adicionais
 */
router.put('/reordenar/:empresaId', autenticarToken, verificarPermissao('clientes.editar'), async (req, res) => {
  try {
    const { empresaId } = req.params;
    const { campos } = req.body; // Array com {id, ordem}

    if (!Array.isArray(campos)) {
      return res.status(400).json({ error: 'Array de campos é obrigatório.' });
    }

    // Atualizar ordem de cada campo
    for (const campo of campos) {
      await db.query(
        'UPDATE campos_adicionais SET ordem = ? WHERE id = ? AND empresaId = ?',
        [campo.ordem, campo.id, empresaId]
      );
    }

    res.json({ success: true, message: 'Ordem dos campos atualizada com sucesso!' });
  } catch (error) {
    console.error('❌ Erro ao reordenar campos:', error);
    res.status(500).json({ error: 'Erro ao reordenar campos.' });
  }
});

// =====================================================
// 📋 ROTAS PARA VALORES DOS CAMPOS ADICIONAIS
// =====================================================

/**
 * 📌 Buscar valores dos campos adicionais de um cliente
 */
router.get('/cliente/:clienteId', autenticarToken, verificarPermissao('clientes.visualizar'), async (req, res) => {
  try {
    const { clienteId } = req.params;

    const [valores] = await db.query(
      `SELECT 
        cca.id,
        cca.campoAdicionalId,
        cca.valor,
        ca.nome as campoNome,
        ca.tipo as campoTipo,
        ca.opcoes as campoOpcoes,
        ca.obrigatorio as campoObrigatorio,
        ca.ordem as campoOrdem
       FROM clientes_campos_adicionais cca
       INNER JOIN campos_adicionais ca ON cca.campoAdicionalId = ca.id
       WHERE cca.clienteId = ? AND ca.ativo = true
       ORDER BY ca.ordem ASC, ca.nome ASC`,
      [clienteId]
    );

    // Processar opções JSON
    const valoresProcessados = valores.map(valor => ({
      ...valor,
      campoOpcoes: valor.campoOpcoes ? JSON.parse(valor.campoOpcoes) : null
    }));

    res.json(valoresProcessados);
  } catch (error) {
    console.error('❌ Erro ao buscar valores dos campos:', error);
    res.status(500).json({ error: 'Erro ao buscar valores dos campos.' });
  }
});

/**
 * 📌 Salvar/atualizar valores dos campos adicionais de um cliente
 */
router.post('/cliente/:clienteId', autenticarToken, verificarPermissao('clientes.editar'), async (req, res) => {
  try {
    const { clienteId } = req.params;
    const { campos } = req.body; // Array com {campoAdicionalId, valor}

    if (!Array.isArray(campos)) {
      return res.status(400).json({ error: 'Array de campos é obrigatório.' });
    }

    // Verificar se o cliente existe
    const [clienteExiste] = await db.query(
      'SELECT id FROM clientes WHERE id = ?',
      [clienteId]
    );

    if (clienteExiste.length === 0) {
      return res.status(404).json({ error: 'Cliente não encontrado.' });
    }

    // Salvar/atualizar cada campo
    for (const campo of campos) {
      const { campoAdicionalId, valor } = campo;

      // Verificar se já existe valor para este campo
      const [existe] = await db.query(
        'SELECT id FROM clientes_campos_adicionais WHERE clienteId = ? AND campoAdicionalId = ?',
        [clienteId, campoAdicionalId]
      );

      if (existe.length > 0) {
        // Atualizar valor existente
        await db.query(
          'UPDATE clientes_campos_adicionais SET valor = ? WHERE clienteId = ? AND campoAdicionalId = ?',
          [valor, clienteId, campoAdicionalId]
        );
      } else {
        // Inserir novo valor
        await db.query(
          'INSERT INTO clientes_campos_adicionais (clienteId, campoAdicionalId, valor) VALUES (?, ?, ?)',
          [clienteId, campoAdicionalId, valor]
        );
      }
    }

    res.json({ success: true, message: 'Valores dos campos salvos com sucesso!' });
  } catch (error) {
    console.error('❌ Erro ao salvar valores dos campos:', error);
    res.status(500).json({ error: 'Erro ao salvar valores dos campos.' });
  }
});

/**
 * 📌 Remover valor de um campo adicional específico
 */
router.delete('/cliente/:clienteId/campo/:campoAdicionalId', autenticarToken, verificarPermissao('clientes.editar'), async (req, res) => {
  try {
    const { clienteId, campoAdicionalId } = req.params;

    const [resultado] = await db.query(
      'DELETE FROM clientes_campos_adicionais WHERE clienteId = ? AND campoAdicionalId = ?',
      [clienteId, campoAdicionalId]
    );

    if (resultado.affectedRows === 0) {
      return res.status(404).json({ error: 'Valor do campo não encontrado.' });
    }

    res.json({ success: true, message: 'Valor do campo removido com sucesso!' });
  } catch (error) {
    console.error('❌ Erro ao remover valor do campo:', error);
    res.status(500).json({ error: 'Erro ao remover valor do campo.' });
  }
});

module.exports = router;
