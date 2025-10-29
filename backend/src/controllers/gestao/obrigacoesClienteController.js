const db = require('../../config/database'); // conexão mysql2/promise

// LISTAR obrigações do cliente com filtros
const listar = async (req, res) => {
  try {
    const { clienteId, competencia, status, departamentoGlobalId } = req.query;

    if (!clienteId) {
      return res.status(400).json({ error: 'clienteId é obrigatório' });
    }

    const params = [clienteId];
    let whereClause = 'WHERE oc.clienteId = ?';

    if (competencia) {
      whereClause += ' AND oc.competencia = ?';
      params.push(competencia);
    }

    if (status) {
      whereClause += ' AND oc.status = ?';
      params.push(status);
    }

    if (departamentoGlobalId) {
      whereClause += ' AND o.departamentoGlobalId = ?';
      params.push(departamentoGlobalId);
    }

    const [rows] = await db.execute(
      `SELECT 
        oc.*, 
        o.nome AS obrigacao_nome, o.descricao, o.departamentoGlobalId, o.recorrencia, o.tipo_arquivo,
        c.nome AS cliente_nome, c.cnpjCpf
      FROM obrigacoes_clientes oc
      JOIN obrigacoes o ON o.id = oc.obrigacaoId
      JOIN clientes c ON c.id = oc.clienteId
      ${whereClause}
      ORDER BY oc.competencia DESC`,
      params
    );

    res.json(rows);
  } catch (error) {
    console.error('Erro ao listar obrigações:', error);
    res.status(500).json({ error: 'Erro interno ao buscar obrigações' });
  }
};

// CRIAR manualmente (se necessário)
const criar = async (req, res) => {
  try {
    const {
      clienteId,
      obrigacaoId,
      competencia,
      status = 'pendente',
      baixadaAutomaticamente = false
    } = req.body;

    const [result] = await db.execute(
      `INSERT INTO obrigacoes_clientes 
       (clienteId, obrigacaoId, competencia, status, baixadaAutomaticamente, dataCriacao)
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [clienteId, obrigacaoId, competencia, status, baixadaAutomaticamente]
    );

    res.status(201).json({ id: result.insertId });
  } catch (error) {
    console.error('Erro ao criar obrigação do cliente:', error);
    res.status(500).json({ error: 'Erro ao criar obrigação do cliente.' });
  }
};

// ATUALIZAR (ex: marcar como baixada)
const atualizar = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, baixadaAutomaticamente } = req.body;

    const [result] = await db.execute(
      `UPDATE obrigacoes_clientes 
       SET status = ?, baixadaAutomaticamente = ?
       WHERE id = ?`,
      [status, baixadaAutomaticamente, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Registro não encontrado.' });
    }

    res.status(200).json({ mensagem: 'Atualizado com sucesso.' });
  } catch (error) {
    console.error('Erro ao atualizar:', error);
    res.status(500).json({ error: 'Erro ao atualizar obrigação do cliente' });
  }
};

// REMOVER (se for necessário deletar)
const remover = async (req, res) => {
  try {
    const { id } = req.params;

    const [result] = await db.execute(
      'DELETE FROM obrigacoes_clientes WHERE id = ?',
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Obrigação do cliente não encontrada.' });
    }

    res.status(200).json({ mensagem: 'Removida com sucesso.' });
  } catch (error) {
    console.error('Erro ao remover obrigação do cliente:', error);
    res.status(500).json({ error: 'Erro ao remover obrigação do cliente.' });
  }
};

module.exports = {
  listar,
  criar,
  atualizar,
  remover
};
