const express = require('express');
const router = express.Router();
const db = require('../../config/database');
const verifyToken = require('../../middlewares/auth');


// Função para gerar código aleatório alfanumérico (6 caracteres)
function gerarCodigoProduto(tamanho = 6) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let codigo = '';
  for (let i = 0; i < tamanho; i++) {
    codigo += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return codigo;
}

// Criar um novo produto (com código gerado automaticamente)
router.post('/', verifyToken, async (req, res) => {
  const { nome, valor, descricao, status = 'ativo', empresa_id, global, tipo = 'produto'} = req.body;

  if (!nome) {
    return res.status(400).json({ error: 'Campos obrigatórios: nome, empresa_id' });
  }

  // Função que garante código único
  async function gerarCodigoUnico() {
    let codigo;
    let tentativas = 0;
    const maxTentativas = 10;
    do {
      codigo = gerarCodigoProduto();
      const [existe] = await db.query('SELECT id FROM produtos WHERE codigo = ?', [codigo]);
      if (existe.length === 0) return codigo;
      tentativas++;
    } while (tentativas < maxTentativas);

    throw new Error('Não foi possível gerar código único após várias tentativas.');
  }

  try {
    const codigo = await gerarCodigoUnico();
    const valorFinal = valor === '' ? null : valor;

    const query = `
      INSERT INTO produtos (codigo, nome, valor, descricao, status, empresa_id, global, tipo)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const [result] = await db.execute(query, [codigo, nome, valorFinal, descricao, status, empresa_id, global, tipo]);

    res.status(201).json({
      id: result.insertId,
      codigo,
      nome,
      valor: valorFinal,
      descricao,
      status,
      empresa_id,
      global,
      tipo,
    });
  } catch (error) {
    console.error('Erro ao criar produto:', error);
    res.status(500).json({ error: 'Erro ao criar produto' });
  }
});


// Listar todos os produtos da empresa + (globais, exceto para 'nao_franqueado')
router.get('/empresa/:empresa_id', verifyToken, async (req, res) => {
  const { empresa_id } = req.params;

  try {
    // Algumas bases não possuem role_empresa; retornamos sempre produtos da empresa + globais
    const [products] = await db.query(
      'SELECT * FROM produtos WHERE empresa_id = ? OR global = 1',
      [empresa_id]
    );
    res.json(products);
  } catch (error) {
    console.error('Erro ao listar produtos da empresa:', error);
    res.status(500).json({ error: 'Erro ao listar produtos' });
  }
});



// Detalhar um produto específico
router.get('/:id', verifyToken, async (req, res) => {
  const { id } = req.params;

  try {
    const [product] = await db.query('SELECT * FROM produtos WHERE id = ?', [id]);

    if (product.length === 0) {
      return res.status(404).json({ error: 'Produto não encontrado' });
    }

    res.json(product[0]);
  } catch (error) {
    console.error('Erro ao buscar produto:', error);
    res.status(500).json({ error: 'Erro ao buscar produto' });
  }
});

// Editar um produto
router.put('/:id', verifyToken, async (req, res) => {
  const { id } = req.params;
  const { nome, valor, descricao, status, global, tipo } = req.body;

  // Tratamento para o valor (igual ao POST)
  const valorFinal = valor === '' ? null : valor;

  try {
    await db.query(
      `
        UPDATE produtos SET nome = ?, valor = ?, descricao = ?, status = ?, global = ?, tipo = ?
        WHERE id = ?
      `,
      [nome, valorFinal, descricao, status, global, tipo, id]
    );

    res.json({ message: 'Produto atualizado com sucesso.' });
  } catch (error) {
    console.error('Erro ao atualizar produto:', error);
    res.status(500).json({ error: 'Erro ao atualizar produto' });
  }
});


// Deletar um produto
router.delete('/:id', verifyToken, async (req, res) => {
  const { id } = req.params;

  try {
    await db.query('DELETE FROM produtos WHERE id = ?', [id]);
    res.json({ message: 'Produto deletado com sucesso.' });
  } catch (error) {
    console.error('Erro ao deletar produto:', error);
    res.status(500).json({ error: 'Erro ao deletar produto' });
  }
});

// Vincular um produto a um lead
router.post('/produto_lead', verifyToken, async (req, res) => {
  const { produto_id, lead_id, valor_de_venda, desconto, quantidade } = req.body;

  if (!produto_id || !lead_id || !valor_de_venda  || !quantidade) {
    return res.status(400).json({ error: 'produto_id, lead_id, valor_de_venda e quantidade são obrigatórios' });
  }

  try {
    // Inserir o produto no lead com valor de venda, desconto e quantidade
    const query = `
      INSERT INTO produto_lead (produto_id, lead_id, valor_de_venda, desconto, quantidade)
      VALUES (?, ?, ?, ?, ?)
    `;
    const [result] = await db.execute(query, [produto_id, lead_id, valor_de_venda, desconto, quantidade]);

    res.status(201).json({
      id: result.insertId,
      produto_id,
      lead_id,
      valor_de_venda,
      desconto,
      quantidade,
    });
  } catch (error) {
    console.error('Erro ao vincular produto ao lead:', error);
    res.status(500).json({ error: 'Erro ao vincular produto ao lead' });
  }
});



// Listar todos os produtos associados a um lead
router.get('/produto_lead/:lead_id', verifyToken, async (req, res) => {
  const { lead_id } = req.params;

  try {
    const [products] = await db.query(`
      SELECT p.*, pl.desconto, pl.quantidade, pl.valor_de_venda
      FROM produto_lead pl
      JOIN produtos p ON pl.produto_id = p.id
      WHERE pl.lead_id = ?
    `, [lead_id]);

    res.json(products);
  } catch (error) {
    console.error('Erro ao listar produtos por lead:', error);
    res.status(500).json({ error: 'Erro ao listar produtos por lead' });
  }
});


// Atualizar um produto vinculado a um lead (desconto, valor de venda e quantidade)
router.put('/produto_lead/:id', verifyToken, async (req, res) => {
  const { id } = req.params;
  const { valor_de_venda, desconto, quantidade } = req.body;

  // Verificar se os campos obrigatórios estão presentes
  if (!valor_de_venda  || !quantidade) {
    return res.status(400).json({ error: 'valor_de_venda, desconto e quantidade são obrigatórios' });
  }

  try {
    // Atualizar os dados do produto-lead
    const query = `
      UPDATE produto_lead
      SET valor_de_venda = ?, desconto = ?, quantidade = ?
      WHERE id = ?
    `;
    const [result] = await db.execute(query, [valor_de_venda, desconto, quantidade, id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Produto-lead não encontrado' });
    }

    res.status(200).json({ message: 'Produto-lead atualizado com sucesso' });
  } catch (error) {
    console.error('Erro ao atualizar produto-lead:', error);
    res.status(500).json({ error: 'Erro ao atualizar produto-lead' });
  }
});



// Remover um produto de um lead
router.delete('/produto_lead/:id', verifyToken, async (req, res) => {
  const { id } = req.params;

  try {
    await db.query('DELETE FROM produto_lead WHERE id = ?', [id]);
    res.json({ message: 'Produto desvinculado do lead com sucesso.' });
  } catch (error) {
    console.error('Erro ao desvincular produto de lead:', error);
    res.status(500).json({ error: 'Erro ao desvincular produto de lead' });
  }
});



module.exports = router;
