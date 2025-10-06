const express = require("express");
const router = express.Router();
const db = require("../config/database"); // Adapte o caminho conforme necessário

// 1. Listar as empresas de um lead
router.get('/:lead_id', async (req, res) => {
  const { lead_id } = req.params;

  try {
    const [empresas] = await db.query(
      'SELECT * FROM empresa WHERE lead_id = ?',
      [lead_id]
    );

    if (empresas.length === 0) {
      return res.status(404).json({ error: 'Nenhuma empresa encontrada para este lead' });
    }

    return res.json(empresas);
  } catch (error) {
    console.error('Erro ao buscar empresas:', error);
    return res.status(500).json({ error: 'Erro ao buscar empresas' });
  }
});

// 2. Buscar uma empresa específica por ID
router.get('/empresa/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const [empresa] = await db.query(
      'SELECT * FROM empresa WHERE id = ?',
      [id]
    );

    if (empresa.length === 0) {
      return res.status(404).json({ error: 'Empresa não encontrada' });
    }

    return res.json(empresa[0]); // Retorna o primeiro (e único) resultado
  } catch (error) {
    console.error('Erro ao buscar empresa:', error);
    return res.status(500).json({ error: 'Erro ao buscar empresa' });
  }
});

// 3. Criar uma nova empresa
router.post('/', async (req, res) => {
  const { lead_id, nome, cnpj, endereco } = req.body;

  if (!lead_id || !nome) {
    return res.status(400).json({ error: 'lead_id e nome são obrigatórios' });
  }

  try {
    const [result] = await db.query(
      'INSERT INTO empresa (lead_id, nome, cnpj, endereco) VALUES (?, ?, ?, ?)',
      [lead_id, nome, cnpj || null, endereco || null]
    );
    
    res.status(201).json({ message: 'Empresa criada com sucesso', id: result.insertId });
  } catch (error) {
    console.error('Erro ao criar empresa:', error);
    res.status(500).json({ error: 'Erro ao criar empresa' });
  }
});

// 4. Atualizar uma empresa existente
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { nome, cnpj, endereco } = req.body;

  if (!nome) {
    return res.status(400).json({ error: 'Nome é obrigatório' });
  }

  try {
    const [result] = await db.query(
      'UPDATE empresa SET nome = ?, cnpj = ?, endereco = ? WHERE id = ?',
      [nome, cnpj || null, endereco || null, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Empresa não encontrada' });
    }

    res.json({ message: 'Empresa atualizada com sucesso' });
  } catch (error) {
    console.error('Erro ao atualizar empresa:', error);
    res.status(500).json({ error: 'Erro ao atualizar empresa' });
  }
});

// 5. Deletar uma empresa
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const [result] = await db.query('DELETE FROM empresa WHERE id = ?', [id]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Empresa não encontrada' });
    }

    res.status(204).send();
  } catch (error) {
    console.error('Erro ao deletar empresa:', error);
    res.status(500).json({ error: 'Erro ao deletar empresa' });
  }
});

module.exports = router;
