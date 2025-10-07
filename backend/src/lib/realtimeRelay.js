const { WebSocketServer } = require('ws');
let RealtimeClient = null;

class RealtimeRelay {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.sockets = new WeakMap();
    this.wss = null;
  }

  listen(server) {
    this.wss = new WebSocketServer({ 
      server,
      path: '/ws'
    });
    this.wss.on('connection', this.connectionHandler.bind(this));
    console.log('[RealtimeRelay] WebSocket server listening on /ws');
  }

  async connectionHandler(ws, req) {
    if (!req.url) {
      this.log('No URL provided, closing connection.');
      ws.close();
      return;
    }

    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname;

    if (pathname !== '/ws') {
      this.log(`Invalid pathname: "${pathname}"`);
      ws.close();
      return;
    }

    // Lazy-load do cliente Realtime (ESM) via import dinâmico
    if (!RealtimeClient) {
      try {
        const mod = await import('@openai/realtime-api-beta');
        RealtimeClient = mod.RealtimeClient;
      } catch (e) {
        this.log('Falha ao carregar @openai/realtime-api-beta:', e.message);
        ws.close();
        return;
      }
    }

    // Instancia o cliente e conecta
    this.log(`Connecting with key "${this.apiKey.slice(0, 3)}..."`);
    const client = new RealtimeClient({
      apiKey: this.apiKey,
      model: process.env.OPENAI_REALTIME_MODEL || 'gpt-4o-realtime-preview-2024-12-17',
    });

    // OpenAI -> Browser
    client.realtime.on('server.*', (event) => {
      try {
        ws.send(JSON.stringify(event));
      } catch (e) {
        this.log('Erro ao enviar evento ao cliente:', e.message);
      }
    });
    client.realtime.on('error', (err) => {
      this.log('Realtime client error:', err?.message || err);
      // Não derruba o processo
    });
    if (typeof client.on === 'function') {
      try {
        client.on('error', (err) => {
          this.log('Realtime client top-level error:', err?.message || err);
        });
      } catch {}
    }
    client.realtime.on('close', () => {
      try { ws.close(); } catch {}
    });

    // Browser -> OpenAI (fila até conectar)
    const messageQueue = [];
    const messageHandler = (data) => {
      try {
        const event = JSON.parse(data);
        client.realtime.send(event.type, event);
      } catch (e) {
        this.log('Erro ao parsear evento do cliente:', e.message);
      }
    };
    ws.on('message', (data) => {
      if (!client.isConnected()) messageQueue.push(data);
      else messageHandler(data);
    });
    ws.on('close', () => {
      try { client.disconnect(); } catch {}
    });

    try {
      await client.connect();
    } catch (e) {
      this.log(`Error connecting to OpenAI: ${e.message}`);
      try { ws.close(); } catch {}
      return;
    }
    this.log('Connected to OpenAI successfully!');
    try {
      while (messageQueue.length) messageHandler(messageQueue.shift());
    } catch (e) {
      this.log('Erro ao processar fila inicial:', e?.message || e);
    }
  }

  log(...args) {
    console.log(`[RealtimeRelay]`, ...args);
  }
}

module.exports = { RealtimeRelay };
