const express = require('express');
const router = express.Router();
const obrigacoesClienteController = require('../../controllers/gestao/obrigacoesClienteController');

// Listar obrigações por cliente (com filtros opcionais)
router.get('/', obrigacoesClienteController.listar);

// (Futuramente)
// router.post('/baixar', obrigacoesClienteController.baixar); ← endpoint para baixa manual

module.exports = router;
