const router = require('express').Router();
const db = require('../../config/database');
const crypto = require('crypto');
const authOrApiKey = require("../../middlewares/authOrApiKey");

// 🔹 Listar todas as API Keys
router.get('/', authOrApiKey, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT id, nome, chave, ativo, criado_em FROM api_keys ORDER BY criado_em DESC');
    res.json(rows);
  } catch (error) {
    console.error('Erro ao listar API Keys:', error);
    res.status(500).json({ error: 'Erro ao listar API Keys' });
  }
});

// 🔹 Criar nova API Key
router.post('/', authOrApiKey, async (req, res) => {
  const { nome } = req.body;

  if (!nome) {
    return res.status(400).json({ error: 'O campo nome é obrigatório.' });
  }

  // Gera uma chave segura (64 caracteres hex)
  const chave = crypto.randomBytes(32).toString('hex');

  try {
    const [result] = await db.query(
      'INSERT INTO api_keys (nome, chave, ativo) VALUES (?, ?, 1)',
      [nome, chave]
    );
    res.status(201).json({
      message: 'API Key criada com sucesso.',
      id: result.insertId,
      nome,
      chave
    });
  } catch (error) {
    console.error('Erro ao criar API Key:', error);
    res.status(500).json({ error: 'Erro ao criar API Key' });
  }
});

// 🔹 Editar uma API Key
router.put('/:id', authOrApiKey, async (req, res) => {
  const { id } = req.params;
  
  const { nome } = req.body;

  if (!nome) {
    return res.status(400).json({ error: 'O campo nome é obrigatório.' });
  }

  try {
    const [result] = await db.query(
      'UPDATE api_keys SET nome = ? WHERE id = ?',
      [nome, id]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'API Key não encontrada.' });
    }
    
    res.json({ message: 'API Key editada com sucesso.' });
  } catch (error) {
    console.error('Erro ao editar API Key:', error);
    res.status(500).json({ error: 'Erro ao editar API Key' });
  }
});

// 🔹 Alterar status de uma API Key
router.patch('/:id/status', authOrApiKey, async (req, res) => {
  const { id } = req.params;
  const { ativo } = req.body;

  if (typeof ativo !== 'boolean') {
    return res.status(400).json({ error: 'O campo ativo deve ser um valor booleano.' });
  }

  try {
    const [result] = await db.query(
      'UPDATE api_keys SET ativo = ? WHERE id = ?',
      [ativo, id]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'API Key não encontrada.' });
    }
    
    res.json({ 
      message: `API Key ${ativo ? 'ativada' : 'desativada'} com sucesso.`,
      ativo 
    });
  } catch (error) {
    console.error('Erro ao alterar status da API Key:', error);
    res.status(500).json({ error: 'Erro ao alterar status da API Key' });
  }
});

// 🔹 Deletar uma API Key
router.delete('/:id', authOrApiKey, async (req, res) => {
  const { id } = req.params;

  try {
    const [result] = await db.query(
      'DELETE FROM api_keys WHERE id = ?',
      [id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'API Key não encontrada.' });
    }
    res.json({ message: 'API Key deletada com sucesso.' });
  } catch (error) {
    console.error('Erro ao deletar API Key:', error);
    res.status(500).json({ error: 'Erro ao deletar API Key' });
  }
});

module.exports = router;
