const express = require("express");
const pool = require("../config/database");
const verifyToken = require("../middlewares/auth");
const router = express.Router();

// 1. Rota para fazer upload de um arquivo (base64) associado ao lead
router.post('/upload/:lead_id', verifyToken, async (req, res) => {
  const { lead_id } = req.params; // Obtemos o lead_id da URL
  const { base64File, fileName, fileType } = req.body; // Dados de base64, nome e tipo do arquivo
  const enviado_por = req.user.full_name; // O nome do usuário autenticado

  if (!base64File || !fileName || !fileType) {
    return res.status(400).json({ error: 'Faltando dados do arquivo.' });
  }

  try {
    // Salvando o arquivo em base64 no banco de dados
    await pool.query(
      'INSERT INTO arquivos (lead_id, nome_arquivo, arquivo_base64, tipo, enviado_por) VALUES (?, ?, ?, ?, ?)',
      [lead_id, fileName, base64File, fileType, enviado_por]
    );

    res.json({ message: 'Arquivo enviado com sucesso!' });
  } catch (error) {
    console.error('Erro ao salvar arquivo base64:', error);
    res.status(500).json({ error: 'Erro ao salvar arquivo base64.' });
  }
});

// 2. Rota para obter os arquivos de um lead específico
router.get('/:lead_id', verifyToken, async (req, res) => {
  const { lead_id } = req.params; // Obtemos o lead_id da URL

  try {
    // Consultar todos os arquivos do lead
    const [arquivos] = await pool.query('SELECT * FROM arquivos WHERE lead_id = ?', [lead_id]);

    if (arquivos.length === 0) {
      return res.status(404).json({ error: 'Nenhum arquivo encontrado para este lead.' });
    }

    res.json(arquivos);
  } catch (error) {
    console.error('Erro ao buscar arquivos:', error);
    res.status(500).json({ error: 'Erro ao buscar arquivos.' });
  }
});

// 3. Rota para excluir um arquivo específico
router.delete('/:id', verifyToken, async (req, res) => {
  const { id } = req.params; // Obtemos o ID do arquivo da URL

  try {
    // Consultar o arquivo no banco de dados
    const [arquivo] = await pool.query('SELECT * FROM arquivos WHERE id = ?', [id]);

    if (arquivo.length === 0) {
      return res.status(404).json({ error: 'Arquivo não encontrado.' });
    }

    // Excluir o arquivo do banco de dados
    await pool.query('DELETE FROM arquivos WHERE id = ?', [id]);

    res.json({ message: 'Arquivo excluído com sucesso.' });
  } catch (error) {
    console.error('Erro ao excluir arquivo:', error);
    res.status(500).json({ error: 'Erro ao excluir arquivo.' });
  }
});

// 4. Rota para fazer o download de um arquivo específico
router.get('/download/:id', verifyToken, async (req, res) => {
  const { id } = req.params; // Obtemos o ID do arquivo da URL

  try {
    // Consultar o arquivo no banco de dados
    const [arquivo] = await pool.query('SELECT * FROM arquivos WHERE id = ?', [id]);

    if (arquivo.length === 0) {
      return res.status(404).json({ error: 'Arquivo não encontrado.' });
    }

    const fileData = arquivo[0].arquivo_base64; // A string base64 do arquivo armazenado no banco
    const fileName = arquivo[0].nome_arquivo;  // Nome do arquivo
    const fileType = arquivo[0].tipo;          // Tipo do arquivo (ex: 'image/png', 'application/pdf', etc.)

    // Converter a base64 em um Buffer
    const buffer = Buffer.from(fileData, 'base64');

    // Definindo os cabeçalhos para forçar o download
    res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
    res.setHeader('Content-Type', fileType);  // Define o tipo MIME do arquivo

    // Enviar o arquivo binário para o frontend
    res.send(buffer);
  } catch (error) {
    console.error('Erro ao fazer download do arquivo:', error);
    res.status(500).json({ error: 'Erro ao fazer download do arquivo.' });
  }
});

module.exports = router;
