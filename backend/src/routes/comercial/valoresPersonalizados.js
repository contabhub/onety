const express = require('express');
const router = express.Router();
const db = require('../config/database');

// 🔍 GET: Buscar valores personalizados por lead
router.get('/:lead_id', async (req, res) => {
  const { lead_id } = req.params;

  if (!lead_id) {
    return res.status(400).json({ error: 'lead_id é obrigatório' });
  }

  try {
    const [rows] = await db.query(
      'SELECT * FROM valores_personalizados WHERE lead_id = ?',
      [lead_id]
    );
    res.json(rows);
  } catch (error) {
    console.error('Erro ao buscar valores personalizados:', error);
    res.status(500).json({ error: 'Erro ao buscar valores personalizados' });
  }
});

// 💾 POST: Criar ou atualizar valor de um campo
router.post('/', async (req, res) => {
  const { lead_id, campo_id, valor } = req.body;

  if (!lead_id || !campo_id) {
    return res.status(400).json({ error: 'lead_id e campo_id são obrigatórios' });
  }

  try {
    // Verifica se já existe
    const [existing] = await db.query(
      'SELECT * FROM valores_personalizados WHERE lead_id = ? AND campo_id = ?',
      [lead_id, campo_id]
    );

    if (existing.length > 0) {
      // Atualiza
      await db.query(
        'UPDATE valores_personalizados SET valor = ?, updated_at = CURRENT_TIMESTAMP WHERE lead_id = ? AND campo_id = ?',
        [valor, lead_id, campo_id]
      );
      return res.json({ message: 'Valor atualizado com sucesso' });
    }

    // Insere
    await db.query(
      'INSERT INTO valores_personalizados (lead_id, campo_id, valor) VALUES (?, ?, ?)',
      [lead_id, campo_id, valor]
    );
    res.status(201).json({ message: 'Valor criado com sucesso' });
  } catch (error) {
    console.error('Erro ao salvar valor personalizado:', error);
    res.status(500).json({ error: 'Erro ao salvar valor personalizado' });
  }
});

// ✏️ PUT: Atualizar valor personalizado existente por ID
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { valor } = req.body;

  // Verifica se o valor foi enviado
  if (!valor) {
    return res.status(400).json({ error: 'O campo valor é obrigatório' });
  }

  try {
    // Verifica se o valor personalizado com o ID fornecido existe
    const [existing] = await db.query('SELECT * FROM valores_personalizados WHERE id = ?', [id]);

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Valor personalizado não encontrado' });
    }

    // Atualiza o valor específico no banco de dados
    await db.query(
      'UPDATE valores_personalizados SET valor = ? WHERE id = ?',
      [valor, id] // Passando o valor e o id para atualizar o registro correto
    );

    return res.json({ message: 'Valor atualizado com sucesso' });
  } catch (error) {
    console.error('Erro ao atualizar valor personalizado:', error);
    return res.status(500).json({ error: 'Erro ao atualizar valor personalizado' });
  }
});



// 🗑️ DELETE: (opcional)
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    await db.query('DELETE FROM valores_personalizados WHERE id = ?', [id]);
    res.status(204).send();
  } catch (error) {
    console.error('Erro ao deletar valor personalizado:', error);
    res.status(500).json({ error: 'Erro ao deletar valor personalizado' });
  }
});

module.exports = router;
