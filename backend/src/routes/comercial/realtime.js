const express = require('express');
const router = express.Router();
const AudioProcessor = require('../../lib/audioProcessor');
const verifyToken = require('../../middlewares/auth');
const conversationConfig = require('../../config/conversationConfig');

const audioProcessor = new AudioProcessor();

// Rota para obter estatísticas de áudio de uma sessão
router.get('/audio/stats/:sessionId', verifyToken, (req, res) => {
  try {
    const { sessionId } = req.params;
    const stats = audioProcessor.getSessionStats(sessionId);
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Erro ao obter estatísticas de áudio:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// Rota para processar dados de áudio
router.post('/audio/process', verifyToken, (req, res) => {
  try {
    const { audioData, sessionId } = req.body;
    
    if (!audioData || !sessionId) {
      return res.status(400).json({
        success: false,
        error: 'Dados de áudio e sessionId são obrigatórios'
      });
    }

    const audioBuffer = Buffer.from(audioData, 'base64');
    const result = audioProcessor.processAudioData(audioBuffer, sessionId);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Erro ao processar áudio:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao processar dados de áudio'
    });
  }
});

// Rota para salvar áudio em arquivo
router.post('/audio/save/:sessionId', verifyToken, (req, res) => {
  try {
    const { sessionId } = req.params;
    const { filename } = req.body;
    
    if (!filename) {
      return res.status(400).json({
        success: false,
        error: 'Nome do arquivo é obrigatório'
      });
    }

    const filePath = audioProcessor.saveAudioToFile(sessionId, filename);
    
    res.json({
      success: true,
      data: {
        filePath,
        message: 'Áudio salvo com sucesso'
      }
    });
  } catch (error) {
    console.error('Erro ao salvar áudio:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao salvar arquivo de áudio'
    });
  }
});

// Rota para limpar buffer de áudio de uma sessão
router.delete('/audio/clear/:sessionId', verifyToken, (req, res) => {
  try {
    const { sessionId } = req.params;
    audioProcessor.clearSessionBuffer(sessionId);
    
    res.json({
      success: true,
      message: 'Buffer de áudio limpo com sucesso'
    });
  } catch (error) {
    console.error('Erro ao limpar buffer:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao limpar buffer de áudio'
    });
  }
});

// Rota para obter configurações de conversa
router.get('/conversation/config', verifyToken, (req, res) => {
  res.json({
    success: true,
    data: conversationConfig
  });
});

module.exports = router;
