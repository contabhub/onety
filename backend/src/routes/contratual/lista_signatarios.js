const router = require('express').Router();
const db = require('../../config/database');
const verifyToken = require('../../middlewares/auth');

// Listar todos os signatários salvos de uma empresa
router.get('/empresa/:empresa_id', verifyToken, async (req, res) => {
  const { empresa_id } = req.params;
  try {
    const [rows] = await db.query(
      'SELECT * FROM lista_signatarios WHERE empresa_id = ? ORDER BY nome',
      [empresa_id]
    );
    res.json(rows);
  } catch (error) {
    console.error('Erro ao buscar lista de signatários:', error);
    res.status(500).json({ error: 'Erro ao buscar lista de signatários.' });
  }
});

// Criar um novo signatário salvo
router.post('/', verifyToken, async (req, res) => {
  try {
    const { nome, email, cpf, data_nascimento, telefone, funcao_assinatura, empresa_id } = req.body;

    if (!nome || !email || !cpf || !funcao_assinatura || !empresa_id) {
      return res.status(400).json({ error: 'Campos obrigatórios: nome, email, cpf, funcao_assinatura, empresa_id.' });
    }

    await db.query(
      'INSERT INTO lista_signatarios (nome, email, cpf, data_nascimento, telefone, funcao_assinatura, empresa_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [
        nome,
        email,
        cpf,
        data_nascimento && data_nascimento.trim() !== '' ? data_nascimento : null,
        telefone,
        funcao_assinatura,
        empresa_id
      ]
    );
    

    res.status(201).json({ message: 'Signatário salvo com sucesso.' });
  } catch (error) {
    console.error('Erro ao salvar signatário:', error);
    res.status(500).json({ error: 'Erro ao salvar signatário.' });
  }
});

// Atualizar signatário salvo
router.put('/:id', verifyToken, async (req, res) => {
  const { id } = req.params;
  const { nome, email, cpf, data_nascimento, telefone, funcao_assinatura } = req.body;

  if (!nome || !email || !cpf || !funcao_assinatura) {
    return res.status(400).json({ error: 'Campos obrigatórios: nome, email, cpf, funcao_assinatura.' });
  }

  try {
    await db.query(
      'UPDATE lista_signatarios SET nome=?, email=?, cpf=?, data_nascimento=?, telefone=?, funcao_assinatura=? WHERE id=?',
      [
        nome,
        email,
        cpf,
        data_nascimento && data_nascimento.trim() !== '' ? data_nascimento : null,
        telefone,
        funcao_assinatura,
        id
      ]
    );
    
    res.json({ message: 'Signatário atualizado com sucesso.' });
  } catch (error) {
    console.error('Erro ao atualizar signatário:', error);
    res.status(500).json({ error: 'Erro ao atualizar signatário.' });
  }
});

// Deletar signatário salvo
router.delete('/:id', verifyToken, async (req, res) => {
  const { id } = req.params;
  try {
    await db.query('DELETE FROM lista_signatarios WHERE id = ?', [id]);
    res.json({ message: 'Signatário deletado com sucesso.' });
  } catch (error) {
    console.error('Erro ao deletar signatário:', error);
    res.status(500).json({ error: 'Erro ao deletar signatário.' });
  }
});

module.exports = router;
