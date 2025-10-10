console.log("Iniciando servidor...");
const express = require("express");
const cors = require("cors");
require("dotenv").config();
const routes = require("./routes");
const webSocketManager = require("./websocket");
require("./workers/expireContracts");


const app = express();

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Health check endpoint para Docker
app.get('/health', (req, res) => {
    res.status(200).json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

app.use(routes);


const { staticFiles, audioFiles } = require('./middlewares/staticFiles');
const createDirectories = require('./scripts/setupDirectories');

// Criar diretórios necessários (uploads, etc.)
try {
    createDirectories();
} catch (e) {
    console.log('Falha ao criar diretórios:', e.message);
}

// Servir arquivos estáticos
app.use('/uploads', staticFiles);
app.use('/audio', audioFiles);


// Definir porta dinâmica para produção ou desenvolvimento
const port = process.env.PORT || 5000;

// Iniciar o servidor apenas se rodando localmente
if (require.main === module) {
    const server = app.listen(port, () => {
        console.log(`Servidor rodando na porta ${port}`);
    });

        // Inicializa o Realtime Relay WebSocket em /ws se houver OPENAI_API_KEY
        try {
            const { RealtimeRelay } = require('./lib/realtimeRelay');
            const openaiKey = process.env.REALTIME_API_KEY;
            if (openaiKey) {
                const relay = new RealtimeRelay(openaiKey);
                relay.listen(server);
            } else {
                console.log('[RealtimeRelay] OPENAI_API_KEY não definido. WS /ws não será iniciado.');
            }
        } catch (e) {
            console.log('[RealtimeRelay] Não foi possível carregar o relay:', e.message);
        }

    // Inicializar WebSocket
    webSocketManager.initialize(server);

    server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            console.log(`Porta ${port} em uso, tentando outra...`);
            app.listen(0, () => {
                console.log(`Servidor rodando em uma porta aleatória`);
            });
        } else {
            console.error(err);
        }
    });
}

// Exportamos o app para a Vercel
module.exports = app;
