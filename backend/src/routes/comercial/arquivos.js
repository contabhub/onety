const express = require("express");
const pool = require("../../config/database");
const verifyToken = require("../../middlewares/auth");
const multer = require('multer');
const cloudinary = require('../../config/cloudinary');
const router = express.Router();

const upload = multer({ storage: multer.memoryStorage() });

// 1. Rota para fazer upload de um arquivo para Cloudinary associado ao lead
router.post('/upload/:lead_id', verifyToken, upload.single('arquivo'), async (req, res) => {
  const { lead_id } = req.params;
  const enviado_por = req.user.full_name;
  const arquivo = req.file;

  if (!arquivo) {
    return res.status(400).json({ error: 'Nenhum arquivo foi enviado.' });
  }

  try {
    // Verificar se o lead existe (tabela correta: leads)
    const [leadExists] = await pool.query('SELECT id FROM leads WHERE id = ?', [lead_id]);
    if (leadExists.length === 0) {
      return res.status(404).json({ error: 'Lead não encontrado.' });
    }

    // Determinar o resource_type baseado no tipo de arquivo
    let resourceType = 'auto';
    if (arquivo.mimetype.startsWith('image/')) {
      resourceType = 'image';
    } else if (arquivo.mimetype.startsWith('video/')) {
      resourceType = 'video';
    } else if (arquivo.mimetype === 'application/pdf') {
      resourceType = 'image'; // PDFs são tratados como images no Cloudinary
    } else {
      resourceType = 'raw'; // Para outros tipos (docs, xlsx, etc)
    }

    // Upload para Cloudinary usando stream
    const uploadPromise = new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: `onety/leads-arquivos/${lead_id}`,
          resource_type: resourceType,
          public_id: `${Date.now()}_${arquivo.originalname.replace(/\.[^/.]+$/, "")}`,
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      uploadStream.end(arquivo.buffer);
    });

    const uploadResult = await uploadPromise;

    // Salvar no banco de dados apenas com a URL do Cloudinary
    const [result] = await pool.query(
      'INSERT INTO crm_arquivos (lead_id, nome_arquivo, arquivo_url, tipo, enviado_por) VALUES (?, ?, ?, ?, ?)',
      [lead_id, arquivo.originalname, uploadResult.secure_url, arquivo.mimetype, enviado_por]
    );

    // Buscar o arquivo recém-criado
    const [novoArquivo] = await pool.query('SELECT * FROM crm_arquivos WHERE id = ?', [result.insertId]);

    res.json({ 
      message: 'Arquivo enviado com sucesso!',
      arquivo: novoArquivo[0]
    });
  } catch (error) {
    console.error('Erro ao salvar arquivo no Cloudinary:', error);
    res.status(500).json({ error: 'Erro ao salvar arquivo no Cloudinary.' });
  }
});

// 2. Rota para obter os arquivos de um lead específico
router.get('/:lead_id', verifyToken, async (req, res) => {
  const { lead_id } = req.params; // Obtemos o lead_id da URL

  try {
    // Consultar todos os arquivos do lead
    const [arquivos] = await pool.query('SELECT * FROM crm_arquivos WHERE lead_id = ?', [lead_id]);

    if (arquivos.length === 0) {
      return res.status(404).json({ error: 'Nenhum arquivo encontrado para este lead.' });
    }

    res.json(arquivos);
  } catch (error) {
    console.error('Erro ao buscar arquivos:', error);
    res.status(500).json({ error: 'Erro ao buscar arquivos.' });
  }
});

// 3. Rota para excluir um arquivo específico (deleta do Cloudinary também)
router.delete('/:id', verifyToken, async (req, res) => {
  const { id } = req.params;

  try {
    // Consultar o arquivo no banco de dados
    const [arquivo] = await pool.query('SELECT * FROM crm_arquivos WHERE id = ?', [id]);

    if (arquivo.length === 0) {
      return res.status(404).json({ error: 'Arquivo não encontrado.' });
    }

    const arquivoData = arquivo[0];

    // Deletar do Cloudinary derivando o public_id a partir da URL
    if (arquivoData.arquivo_url) {
      try {
        // Extrair o trecho após /upload/
        const afterUpload = arquivoData.arquivo_url.split('/upload/')[1];
        if (afterUpload) {
          let path = afterUpload.split('?')[0]; // remove query params
          path = path.replace(/^v[0-9]+\//, ''); // remove versão (v123456/)
          const publicId = path.replace(/\.[^/.]+$/, ''); // remove extensão

          if (publicId) {
            // Determinar o resource_type baseado no tipo de arquivo
            let resourceType = 'image';
            if (arquivoData.tipo && arquivoData.tipo.startsWith('video/')) {
              resourceType = 'video';
            } else if (arquivoData.tipo && !arquivoData.tipo.startsWith('image/') && arquivoData.tipo !== 'application/pdf') {
              resourceType = 'raw';
            }

            await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
          }
        }
      } catch (cloudinaryError) {
        console.error('Erro ao deletar do Cloudinary:', cloudinaryError);
        // Continua mesmo se falhar no Cloudinary, para limpar o banco
      }
    }

    // Excluir o arquivo do banco de dados
    await pool.query('DELETE FROM crm_arquivos WHERE id = ?', [id]);

    res.json({ message: 'Arquivo excluído com sucesso.' });
  } catch (error) {
    console.error('Erro ao excluir arquivo:', error);
    res.status(500).json({ error: 'Erro ao excluir arquivo.' });
  }
});

// 4. Rota para fazer o download de um arquivo específico (redireciona para Cloudinary)
router.get('/download/:id', verifyToken, async (req, res) => {
  const { id } = req.params;

  try {
    // Consultar o arquivo no banco de dados
    const [arquivo] = await pool.query('SELECT * FROM crm_arquivos WHERE id = ?', [id]);

    if (arquivo.length === 0) {
      return res.status(404).json({ error: 'Arquivo não encontrado.' });
    }

    const arquivoData = arquivo[0];
    const cloudinaryUrl = arquivoData.arquivo_url;

    if (!cloudinaryUrl) {
      return res.status(404).json({ error: 'URL do arquivo não encontrada.' });
    }

    // Redirecionar para a URL do Cloudinary com flags de download
    // O Cloudinary permite forçar download adicionando fl_attachment no URL
    const downloadUrl = cloudinaryUrl.replace('/upload/', '/upload/fl_attachment/');
    
    res.redirect(downloadUrl);
  } catch (error) {
    console.error('Erro ao fazer download do arquivo:', error);
    res.status(500).json({ error: 'Erro ao fazer download do arquivo.' });
  }
});

module.exports = router;
