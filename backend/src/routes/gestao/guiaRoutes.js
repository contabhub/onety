const express = require("express");
const router = express.Router();
const db = require("../../config/database");
const autenticarToken = require("../../middlewares/auth");
const { processarTodasAsImagens } = require("../../services/gestao/cloudinaryService");

// Middleware para verificar se é superadmin
async function verificarSuperAdmin(req, res, next) {
  const usuario = req.usuario;
  if (!usuario) {
    return res.status(401).json({ error: 'Token inválido' });
  }

  // Verificar se o usuário tem permissão de superadmin
  if (!usuario.permissoes?.adm?.includes('superadmin')) {
    return res.status(403).json({ error: 'Acesso negado. Apenas superadmins podem gerenciar artigos.' });
  }

  next();
}

// GET /api/guia/artigos - Buscar todos os artigos (público)
router.get('/artigos', autenticarToken, async (req, res) => {
  try {
    const { categoria, busca } = req.query;
    
    let whereClause = 'WHERE ativo = true';
    let queryParams = [];

    // Filtro por categoria
    if (categoria && categoria !== 'todas') {
      whereClause += ' AND categoria = ?';
      queryParams.push(categoria);
    }

    // Filtro por busca
    if (busca && busca.trim()) {
      whereClause += ' AND (titulo LIKE ? OR conteudo LIKE ?)';
      const searchTerm = `%${busca.trim()}%`;
      queryParams.push(searchTerm, searchTerm);
    }

    const [artigos] = await db.query(`
      SELECT 
        id,
        titulo,
        conteudo,
        categoria,
        ordem,
        criado_em,
        atualizado_em
      FROM guia_artigos 
      ${whereClause}
      ORDER BY categoria, ordem, titulo
    `, queryParams);

    // Buscar categorias disponíveis
    const [categorias] = await db.query(`
      SELECT DISTINCT categoria 
      FROM guia_artigos 
      WHERE ativo = true 
      ORDER BY categoria
    `);

    res.json({
      artigos,
      categorias: categorias.map(c => c.categoria)
    });

  } catch (error) {
    console.error('Erro ao buscar artigos:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// GET /api/guia/artigos/:id - Buscar artigo específico
router.get('/artigos/:id', autenticarToken, async (req, res) => {
  try {
    const { id } = req.params;

    const [artigos] = await db.query(`
      SELECT 
        id,
        titulo,
        conteudo,
        categoria,
        ordem,
        criado_em,
        atualizado_em
      FROM guia_artigos 
      WHERE id = ? AND ativo = true
    `, [id]);

    if (artigos.length === 0) {
      return res.status(404).json({ error: 'Artigo não encontrado' });
    }

    res.json(artigos[0]);

  } catch (error) {
    console.error('Erro ao buscar artigo:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// POST /api/guia/artigos - Criar novo artigo (apenas superadmin)
router.post('/artigos', autenticarToken, verificarSuperAdmin, async (req, res) => {
  try {
    const { titulo, conteudo, categoria = 'Geral', ordem = 0 } = req.body;
    const criadoPor = req.usuario.id;

    if (!titulo || !conteudo) {
      return res.status(400).json({ error: 'Título e conteúdo são obrigatórios' });
    }

    // Processar imagens e converter para Cloudinary
    console.log('🔄 Processando imagens do artigo...');
    const conteudoProcessado = await processarTodasAsImagens(conteudo);
    console.log('✅ Imagens processadas com sucesso!');

    const [result] = await db.query(`
      INSERT INTO guia_artigos (titulo, conteudo, categoria, ordem, criado_por)
      VALUES (?, ?, ?, ?, ?)
    `, [titulo, conteudoProcessado, categoria, ordem, criadoPor]);

    res.status(201).json({
      success: true,
      message: 'Artigo criado com sucesso',
      artigo: {
        id: result.insertId,
        titulo,
        categoria,
        ordem
      }
    });

  } catch (error) {
    console.error('Erro ao criar artigo:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// PUT /api/guia/artigos/:id - Atualizar artigo (apenas superadmin)
router.put('/artigos/:id', autenticarToken, verificarSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { titulo, conteudo, categoria, ordem, ativo } = req.body;

    // Verificar se o artigo existe
    const [artigoExistente] = await db.query(
      'SELECT id FROM guia_artigos WHERE id = ?',
      [id]
    );

    if (artigoExistente.length === 0) {
      return res.status(404).json({ error: 'Artigo não encontrado' });
    }

    // Construir query de atualização dinamicamente
    const campos = [];
    const valores = [];

    if (titulo !== undefined) {
      campos.push('titulo = ?');
      valores.push(titulo);
    }
    if (conteudo !== undefined) {
      // Processar imagens e converter para Cloudinary
      console.log('🔄 Processando imagens do artigo atualizado...');
      const conteudoProcessado = await processarTodasAsImagens(conteudo);
      console.log('✅ Imagens processadas com sucesso!');
      
      campos.push('conteudo = ?');
      valores.push(conteudoProcessado);
    }
    if (categoria !== undefined) {
      campos.push('categoria = ?');
      valores.push(categoria);
    }
    if (ordem !== undefined) {
      campos.push('ordem = ?');
      valores.push(ordem);
    }
    if (ativo !== undefined) {
      campos.push('ativo = ?');
      valores.push(ativo);
    }

    if (campos.length === 0) {
      return res.status(400).json({ error: 'Nenhum campo para atualizar' });
    }

    valores.push(id);

    await db.query(`
      UPDATE guia_artigos 
      SET ${campos.join(', ')}
      WHERE id = ?
    `, valores);

    res.json({
      success: true,
      message: 'Artigo atualizado com sucesso'
    });

  } catch (error) {
    console.error('Erro ao atualizar artigo:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// DELETE /api/guia/artigos/:id - Deletar artigo (apenas superadmin)
router.delete('/artigos/:id', autenticarToken, verificarSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar se o artigo existe
    const [artigoExistente] = await db.query(
      'SELECT id FROM guia_artigos WHERE id = ?',
      [id]
    );

    if (artigoExistente.length === 0) {
      return res.status(404).json({ error: 'Artigo não encontrado' });
    }

    // Soft delete - marcar como inativo
    await db.query(
      'UPDATE guia_artigos SET ativo = false WHERE id = ?',
      [id]
    );

    res.json({
      success: true,
      message: 'Artigo removido com sucesso'
    });

  } catch (error) {
    console.error('Erro ao deletar artigo:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// GET /api/guia/admin/artigos - Listar todos os artigos para admin (incluindo inativos)
router.get('/admin/artigos', autenticarToken, verificarSuperAdmin, async (req, res) => {
  try {
    const [artigos] = await db.query(`
      SELECT 
        ga.id,
        ga.titulo,
        ga.categoria,
        ga.ordem,
        ga.ativo,
        ga.criado_em,
        ga.atualizado_em,
        u.nome as criado_por_nome
      FROM guia_artigos ga
      LEFT JOIN usuarios u ON ga.criado_por = u.id
      ORDER BY ga.categoria, ga.ordem, ga.titulo
    `);

    res.json(artigos);

  } catch (error) {
    console.error('Erro ao buscar artigos para admin:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

module.exports = router;
