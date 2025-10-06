const router = require('express').Router();
const db = require('../../config/database');
const verifyToken = require('../../middlewares/auth');

// 🔹 Listar fases de um funil
router.get('/:funilId', verifyToken, async (req, res) => {
  try {
    const { funilId } = req.params;
    const [rows] = await db.query(
      'SELECT * FROM funil_fases WHERE funil_id = ? ORDER BY ordem ASC',
      [funilId]
    );
    res.json(rows);
  } catch (error) {
    console.error('Erro ao listar fases do funil:', error);
    res.status(500).json({ error: 'Erro ao listar fases do funil' });
  }
});

// 🔹 Criar nova fase
router.post('/', verifyToken, async (req, res) => {
  try {
    const { funil_id, nome, descricao, ordem } = req.body;

    if (!funil_id || !nome) {
      return res.status(400).json({ error: 'funil_id e nome são obrigatórios.' });
    }

    const [result] = await db.query(
      'INSERT INTO funil_fases (funil_id, nome, descricao, ordem) VALUES (?, ?, ?, ?)',
      [funil_id, nome, descricao || '', ordem || 0]
    );

    res.status(201).json({ message: 'Fase criada com sucesso.', faseId: result.insertId });
  } catch (error) {
    console.error('Erro ao criar fase do funil:', error);
    res.status(500).json({ error: 'Erro ao criar fase do funil' });
  }
});

// 🔹 Atualizar fase
router.put('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { nome, descricao, ordem } = req.body;

    if (!nome) {
      return res.status(400).json({ error: 'O campo nome é obrigatório.' });
    }

    await db.query(
      'UPDATE funil_fases SET nome = ?, descricao = ?, ordem = ? WHERE id = ?',
      [nome, descricao || '', ordem || 0, id]
    );

    res.json({ message: 'Fase atualizada com sucesso.' });
  } catch (error) {
    console.error('Erro ao atualizar fase do funil:', error);
    res.status(500).json({ error: 'Erro ao atualizar fase do funil' });
  }
});

// 🔹 Deletar fase
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    await db.query('DELETE FROM funil_fases WHERE id = ?', [id]);
    res.json({ message: 'Fase deletada com sucesso.' });
  } catch (error) {
    console.error('Erro ao deletar fase do funil:', error);
    res.status(500).json({ error: 'Erro ao deletar fase do funil' });
  }
});

// POST /funil_fases/reordenar
router.post('/reordenar', verifyToken, async (req, res) => {
  const { faseAId, ordemA, faseBId, ordemB } = req.body;

  // CORRIGINDO A VALIDAÇÃO:
  if (
    faseAId === undefined || faseAId === null ||
    ordemA === undefined || ordemA === null ||
    faseBId === undefined || faseBId === null ||
    ordemB === undefined || ordemB === null
  ) {
    return res.status(400).json({ error: "Parâmetros obrigatórios faltando." });
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    await conn.query(`UPDATE funil_fases SET ordem = ? WHERE id = ?`, [ordemB, faseAId]);
    await conn.query(`UPDATE funil_fases SET ordem = ? WHERE id = ?`, [ordemA, faseBId]);

    await conn.commit();
    res.status(200).json({ message: "Ordem atualizada com sucesso." });
  } catch (error) {
    await conn.rollback();
    console.error("Erro ao reordenar fases:", error);
    res.status(500).json({ error: "Erro ao reordenar fases." });
  } finally {
    conn.release();
  }
});



module.exports = router;
