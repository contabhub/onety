const router = require('express').Router();
const db = require('../../config/database');
const verifyToken = require('../../middlewares/auth');
const multer = require('multer');
const cloudinary = require('../../config/cloudinary');

const upload = multer({ storage: multer.memoryStorage() });

// Função auxiliar para converter PDF para base64
function convertToBase64(buffer) {
  return buffer.toString('base64');
}

// 🔹 Listar todos os playbooks
router.get('/', verifyToken, async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT 
        p.id, 
        p.nome, 
        p.conteudo, 
        p.empresa_id,
        p.criado_em,
        p.atualizado_em,
        e.nome AS empresa_nome
      FROM playbooks p
      JOIN empresas e ON e.id = p.empresa_id
      ORDER BY p.criado_em DESC
    `);
    res.json(rows);
  } catch (error) {
    console.error('Erro ao listar playbooks:', error);
    res.status(500).json({ error: 'Erro ao listar playbooks' });
  }
});

// 🔹 Listar playbooks por empresa
router.get('/empresa/:empresa_id', verifyToken, async (req, res) => {
  try {
    const { empresa_id } = req.params;
    const [rows] = await db.query(`
      SELECT 
        p.id, 
        p.nome, 
        p.conteudo, 
        p.empresa_id,
        p.criado_em,
        p.atualizado_em,
        e.nome AS empresa_nome
      FROM playbooks p
      JOIN empresas e ON e.id = p.empresa_id
      WHERE p.empresa_id = ?
      ORDER BY p.criado_em DESC
    `, [empresa_id]);
    
    res.json(rows);
  } catch (error) {
    console.error('Erro ao listar playbooks da empresa:', error);
    res.status(500).json({ error: 'Erro ao listar playbooks da empresa' });
  }
});

// 🔹 Obter um playbook específico pelo ID
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await db.query(`
      SELECT 
        p.id, 
        p.nome, 
        p.conteudo, 
        p.empresa_id,
        p.criado_em,
        p.atualizado_em,
        e.nome AS empresa_nome
      FROM playbooks p
      JOIN empresas e ON e.id = p.empresa_id
      WHERE p.id = ?
    `, [id]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Playbook não encontrado.' });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error('Erro ao buscar playbook:', error);
    res.status(500).json({ error: 'Erro ao buscar playbook.' });
  }
});

// 🔹 Criar novo playbook com upload para Cloudinary
router.post('/', verifyToken, upload.single('arquivo'), async (req, res) => {
  try {
    const { nome, empresa_id } = req.body;
    const arquivo = req.file;

    // Validações
    if (!nome || String(nome).trim() === '') {
      return res.status(400).json({ error: 'O campo nome é obrigatório.' });
    }

    if (!empresa_id) {
      return res.status(400).json({ error: 'O campo empresa_id é obrigatório.' });
    }

    if (!arquivo) {
      return res.status(400).json({ error: 'Nenhum arquivo foi enviado.' });
    }

    // Validar se é PDF
    if (!arquivo.originalname.toLowerCase().endsWith('.pdf')) {
      return res.status(400).json({ error: 'Apenas arquivos PDF são permitidos.' });
    }

    // Verificar se a empresa existe
    const [empresaExists] = await db.query('SELECT id FROM empresas WHERE id = ?', [empresa_id]);
    if (empresaExists.length === 0) {
      return res.status(404).json({ error: 'Equipe não encontrada.' });
    }

    // Converter PDF para base64
    const base64Content = convertToBase64(arquivo.buffer);

    // Salvar no banco de dados
    const [result] = await db.query(
      'INSERT INTO playbooks (nome, conteudo, empresa_id) VALUES (?, ?, ?)',
      [nome, base64Content, empresa_id]
    );

    const novoPlaybookId = result.insertId;

    // Buscar o playbook criado com informações da empresa
    const [novoPlaybook] = await db.query(`
      SELECT 
        p.id, 
        p.nome, 
        p.conteudo, 
        p.empresa_id,
        p.criado_em,
        p.atualizado_em,
        e.nome AS empresa_nome
      FROM playbooks p
      JOIN empresas e ON e.id = p.empresa_id
      WHERE p.id = ?
    `, [novoPlaybookId]);

    res.status(201).json({
      message: 'Playbook criado com sucesso!',
      playbook: novoPlaybook[0]
    });
  } catch (error) {
    console.error('Erro ao criar playbook:', error);
    res.status(500).json({ error: 'Erro ao criar playbook' });
  }
});

// 🔹 Atualizar playbook existente
router.put('/:id', verifyToken, upload.single('arquivo'), async (req, res) => {
  try {
    const { id } = req.params;
    const { nome, empresa_id } = req.body;
    const arquivo = req.file;

    // Garante existência do playbook
    const [exists] = await db.query('SELECT id FROM playbooks WHERE id = ?', [id]);
    if (exists.length === 0) {
      return res.status(404).json({ error: 'Playbook não encontrado.' });
    }

    // Monta update apenas com campos enviados
    const fields = [];
    const params = [];

    if (nome != null) {
      if (String(nome).trim() === '') {
        return res.status(400).json({ error: 'O nome não pode ser vazio.' });
      }
      fields.push('nome = ?');
      params.push(nome);
    }

    if (empresa_id != null) {
      // Verificar se a empresa existe
      const [empresaExists] = await db.query('SELECT id FROM empresas WHERE id = ?', [empresa_id]);
      if (empresaExists.length === 0) {
        return res.status(404).json({ error: 'Equipe não encontrada.' });
      }
      fields.push('empresa_id = ?');
      params.push(empresa_id);
    }

    // Se um novo arquivo foi enviado, converter para base64
    if (arquivo) {
      // Validar se é PDF
      if (!arquivo.originalname.toLowerCase().endsWith('.pdf')) {
        return res.status(400).json({ error: 'Apenas arquivos PDF são permitidos.' });
      }

      const base64Content = convertToBase64(arquivo.buffer);
      fields.push('conteudo = ?');
      params.push(base64Content);
    }

    if (!fields.length) {
      return res.status(400).json({ error: 'Nada para atualizar.' });
    }

    params.push(id);
    await db.query(`UPDATE playbooks SET ${fields.join(', ')} WHERE id = ?`, params);

    // Buscar o playbook atualizado
    const [playbookAtualizado] = await db.query(`
      SELECT 
        p.id, 
        p.nome, 
        p.conteudo, 
        p.empresa_id,
        p.criado_em,
        p.atualizado_em,
        e.nome AS empresa_nome
      FROM playbooks p
      JOIN empresas e ON e.id = p.empresa_id
      WHERE p.id = ?
    `, [id]);

    res.json({
      message: 'Playbook atualizado com sucesso.',
      playbook: playbookAtualizado[0]
    });
  } catch (error) {
    console.error('Erro ao atualizar playbook:', error);
    res.status(500).json({ error: 'Erro ao atualizar playbook' });
  }
});

// 🔹 Download de PDF do playbook (base64)
router.get('/:id/download', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    console.log('🔍 Tentando fazer download do playbook ID:', id);
    
    // Buscar o playbook e seu conteúdo base64
    const [playbook] = await db.query(`
      SELECT 
        p.id, 
        p.nome, 
        p.conteudo,
        e.nome AS empresa_nome
      FROM playbooks p
      JOIN empresas e ON e.id = p.empresa_id
      WHERE p.id = ?
    `, [id]);

    if (playbook.length === 0) {
      return res.status(404).json({ error: 'Playbook não encontrado.' });
    }

    const playbookData = playbook[0];
    const base64Content = playbookData.conteudo;

    if (!base64Content) {
      return res.status(404).json({ error: 'Arquivo PDF não encontrado para este playbook.' });
    }

    // Converter base64 para buffer
    const buffer = Buffer.from(base64Content, 'base64');
    
    // Configurar headers para download
    const fileName = `${playbookData.nome.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Length', buffer.length);
    
    res.send(buffer);
  } catch (error) {
    console.error('❌ Erro ao fazer download do playbook:', error);
    res.status(500).json({ error: 'Erro ao fazer download do playbook' });
  }
});

// 🔹 Deletar playbook
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Verificar se o playbook existe
    const [playbook] = await db.query('SELECT id FROM playbooks WHERE id = ?', [id]);
    if (playbook.length === 0) {
      return res.status(404).json({ error: 'Playbook não encontrado.' });
    }

    await db.query('DELETE FROM playbooks WHERE id = ?', [id]);
    res.json({ message: 'Playbook deletado com sucesso.' });
  } catch (error) {
    console.error('Erro ao deletar playbook:', error);
    res.status(500).json({ error: 'Erro ao deletar playbook' });
  }
});

module.exports = router;
