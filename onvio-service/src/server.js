const express = require('express');
const cors = require('cors');
const path = require('path');

// Carregar .env do diretório do serviço Onvio (não do diretório pai)
// Se não existir .env no diretório onvio-service, tentar carregar do diretório pai
const envPath = path.join(__dirname, '../../.env');
try {
  require('dotenv').config({ path: envPath });
} catch (e) {
  require('dotenv').config();
}

const onvioRoutes = require('./routes/onvioRoutes');

const app = express();
// Forçar porta 3001 para o serviço Onvio (ignorar PORT do .env se existir)
const PORT = 3001; // Sempre usar porta 3001 para o serviço Onvio

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rotas
app.use('/api/gestao/onvio', onvioRoutes);

// Rota de health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'onvio-service', timestamp: new Date().toISOString() });
});

// Rota raiz
app.get('/', (req, res) => {
  res.json({ 
    service: 'Onvio Service',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      health: '/health',
      api: '/api/gestao/onvio'
    }
  });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 Onvio Service rodando na porta ${PORT}`);
  console.log(`📡 Health check: http://localhost:${PORT}/health`);
  console.log(`🔗 API: http://localhost:${PORT}/api/gestao/onvio`);
});

module.exports = app;

