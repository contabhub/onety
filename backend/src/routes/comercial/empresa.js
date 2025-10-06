const express = require("express");
const router = express.Router();
const db = require("../../config/database"); // Adapte o caminho conforme necessário

// 1. Listar as crm_empresas de um lead
router.get('/:lead_id', async (req, res) => {
  const { lead_id } = req.params;

  try {
    const [crm_empresas] = await db.query(
      'SELECT * FROM crm_empresa WHERE lead_id = ?',
      [lead_id]
    );

    if (crm_empresas.length === 0) {
      return res.status(404).json({ error: 'Nenhuma crm_empresa encontrada para este lead' });
    }

    return res.json(crm_empresas);
  } catch (error) {
    console.error('Erro ao buscar crm_empresas:', error);
    return res.status(500).json({ error: 'Erro ao buscar crm_empresas' });
  }
});

// 2. Buscar uma crm_empresa específica por ID
router.get('/crm_empresa/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const [crm_empresa] = await db.query(
      'SELECT * FROM crm_empresa WHERE id = ?',
      [id]
    );

    if (crm_empresa.length === 0) {
      return res.status(404).json({ error: 'Empresa não encontrada' });
    }

    return res.json(crm_empresa[0]); // Retorna o primeiro (e único) resultado
  } catch (error) {
    console.error('Erro ao buscar crm_empresa:', error);
    return res.status(500).json({ error: 'Erro ao buscar crm_empresa' });
  }
});

// 3. Criar uma nova crm_empresa
router.post('/', async (req, res) => {
  const { lead_id, nome, cnpj, endereco } = req.body;

  if (!lead_id || !nome) {
    return res.status(400).json({ error: 'lead_id e nome são obrigatórios' });
  }

  try {
    const [result] = await db.query(
      'INSERT INTO crm_empresa (lead_id, nome, cnpj, endereco) VALUES (?, ?, ?, ?)',
      [lead_id, nome, cnpj || null, endereco || null]
    );
    
    res.status(201).json({ message: 'Empresa criada com sucesso', id: result.insertId });
  } catch (error) {
    console.error('Erro ao criar crm_empresa:', error);
    res.status(500).json({ error: 'Erro ao criar crm_empresa' });
  }
});

// 4. Atualizar uma crm_empresa existente
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { nome, cnpj, endereco } = req.body;

  if (!nome) {
    return res.status(400).json({ error: 'Nome é obrigatório' });
  }

  try {
    const [result] = await db.query(
      'UPDATE crm_empresa SET nome = ?, cnpj = ?, endereco = ? WHERE id = ?',
      [nome, cnpj || null, endereco || null, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Empresa não encontrada' });
    }

    res.json({ message: 'Empresa atualizada com sucesso' });
  } catch (error) {
    console.error('Erro ao atualizar crm_empresa:', error);
    res.status(500).json({ error: 'Erro ao atualizar crm_empresa' });
  }
});

// 5. Deletar uma crm_empresa
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const [result] = await db.query('DELETE FROM crm_empresa WHERE id = ?', [id]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Empresa não encontrada' });
    }

    res.status(204).send();
  } catch (error) {
    console.error('Erro ao deletar crm_empresa:', error);
    res.status(500).json({ error: 'Erro ao deletar crm_empresa' });
  }
});

module.exports = router;
