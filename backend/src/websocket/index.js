const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const pool = require('../config/database');

class WebSocketManager {
  constructor() {
    this.io = null;
    this.connectedUsers = new Map(); // userId -> socketId
    this.userSockets = new Map();   // socketId -> userId
  }

  /**
   * 🔧 Inicializa o servidor WebSocket
   */
  initialize(server) {
    this.io = new Server(server, {
      cors: {
        origin: process.env.FRONTEND_URL || "http://localhost:3000",
        methods: ["GET", "POST"],
        credentials: true
      },
      transports: ['websocket', 'polling']
    });

    this.setupMiddleware();
    this.setupEventHandlers();
    
    console.log('🚀 WebSocket inicializado com sucesso!');
  }

  /**
   * 🔐 Configura middleware de autenticação
   */
  setupMiddleware() {
// websocket/index.js (dentro de setupMiddleware)
this.io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token || socket.handshake.headers.authorization;
    const requestedCompanyId = socket.handshake.auth.companyId
      ? Number(socket.handshake.auth.companyId)
      : null;
    if (!token) return next(new Error('Token de autenticação não fornecido'));

    // aceita com ou sem "Bearer "
    const cleanToken = token.replace('Bearer ', '');

    // ✅ seu login assina { id, email } — não { userId }
    const decoded = jwt.verify(cleanToken, process.env.JWT_SECRET);
    const userId = decoded.id || decoded.userId; // fallback se no futuro mudar

    // ✅ sua tabela tem 'nome' (não 'name') e não tem 'active'
    const [users] = await pool.query(
      'SELECT id, nome AS name, email FROM usuarios WHERE id = ?',
      [userId]
    );
    if (users.length === 0) {
      return next(new Error('Usuário não encontrado'));
    }

    // ✅ company_id: se cliente informou no handshake e for associado, usa-o; senão, pega a primeira associação
    let companyId = null;
    if (requestedCompanyId && Number.isFinite(requestedCompanyId)) {
      const [ucRequested] = await pool.query(
        'SELECT empresa_id FROM usuarios_empresas WHERE usuario_id = ? AND empresa_id = ? LIMIT 1',
        [userId, requestedCompanyId]
      );
      if (ucRequested.length > 0) {
        companyId = requestedCompanyId;
      }
    }
    if (!companyId) {
      const [uc] = await pool.query(
        'SELECT empresa_id FROM usuarios_empresas WHERE usuario_id = ? LIMIT 1',
        [userId]
      );
      if (uc.length > 0) {
        companyId = uc[0].empresa_id;
      }
    }

    // Anexa os dados padronizados no socket
    socket.user = { ...users[0], company_id: companyId };
    socket.userId = users[0].id;

    next();
  } catch (error) {
    console.error('❌ Erro na autenticação WebSocket:', error.message);
    next(new Error('Token inválido'));
  }
});

  }

  /**
   * 🎯 Configura handlers de eventos
   */
  setupEventHandlers() {
    this.io.on('connection', (socket) => {
      console.log(`🔌 Usuário ${socket.user.name} (ID: ${socket.userId}) conectado`);

      // Registra o usuário como conectado
      this.registerUser(socket.userId, socket.id);

      // Envia dados iniciais do usuário
      socket.emit('user:connected', {
        userId: socket.userId,
        user: socket.user
      });

      // Handler para desconexão
      socket.on('disconnect', () => {
        this.unregisterUser(socket.userId, socket.id);
        console.log(`🔌 Usuário ${socket.user.name} (ID: ${socket.userId}) desconectado`);
      });

      // Handler para erro
      socket.on('error', (error) => {
        console.error(`❌ Erro no socket do usuário ${socket.userId}:`, error);
      });

      // Handler para join em sala de empresa (com validação de associação)
      socket.on('join:company', async (companyId) => {
        try {
          const targetCompanyId = Number(companyId);
          if (!Number.isFinite(targetCompanyId)) {
            return;
          }

          // Valida se o usuário pertence à empresa solicitada
          const [rows] = await pool.query(
            'SELECT 1 FROM usuarios_empresas WHERE usuario_id = ? AND empresa_id = ? LIMIT 1',
            [socket.userId, targetCompanyId]
          );

          if (rows.length === 0) {
            console.warn(`🚫 Usuário ${socket.user.name} tentou entrar na empresa ${targetCompanyId} sem associação`);
            return;
          }

          // Sair de sala anterior se houver e entrar na nova
          if (socket.user.company_id && socket.user.company_id !== targetCompanyId) {
            socket.leave(`company:${socket.user.company_id}`);
          }
          socket.user.company_id = targetCompanyId;
          socket.join(`company:${targetCompanyId}`);
          console.log(`🏢 Usuário ${socket.user.name} entrou na sala da empresa ${targetCompanyId}`);
        } catch (err) {
          console.error('❌ Erro ao processar join:company:', err?.message || err);
        }
      });

      // Handler para join em sala de equipe
      socket.on('join:team', (teamId) => {
        socket.join(`team:${teamId}`);
        console.log(`👥 Usuário ${socket.user.name} entrou na equipe ${teamId}`);
      });

      // Handler para join em sala de conversa
      socket.on('join:conversation', (conversationId) => {
        socket.join(`conversation:${conversationId}`);
        console.log(`💬 Usuário ${socket.user.name} entrou na conversa ${conversationId}`);
      });
    });
  }

  /**
   * 📝 Registra usuário conectado
   */
  registerUser(userId, socketId) {
    this.connectedUsers.set(userId, socketId);
    this.userSockets.set(socketId, userId);
  }

  /**
   * 🚪 Remove usuário desconectado
   */
  unregisterUser(userId, socketId) {
    this.connectedUsers.delete(userId);
    this.userSockets.delete(socketId);
  }

  /**
   * 📤 Emite evento para um usuário específico
   */
  emitToUser(userId, event, data) {
    const socketId = this.connectedUsers.get(userId);
    if (socketId) {
      this.io.to(socketId).emit(event, data);
    }
  }

  /**
   * 📤 Emite evento para uma sala específica
   */
  emitToRoom(room, event, data) {
    try {
      console.log(`📡 WS emit -> room: ${room} | event: ${event}`);
      this.io.to(room).emit(event, data);
    } catch (err) {
      console.error(`❌ Falha ao emitir WS para room ${room} event ${event}:`, err);
    }
  }

  /**
   * 📤 Emite evento para todos os usuários conectados
   */
  emitToAll(event, data) {
    this.io.emit(event, data);
  }

  /**
   * 🔍 Verifica se um usuário está online
   */
  isUserOnline(userId) {
    return this.connectedUsers.has(userId);
  }

  /**
   * 📊 Retorna estatísticas de conexões
   */
  getStats() {
    return {
      totalConnections: this.io.engine.clientsCount,
      connectedUsers: this.connectedUsers.size,
      rooms: Array.from(this.io.sockets.adapter.rooms.keys())
    };
  }
}

// Exporta uma instância singleton
const webSocketManager = new WebSocketManager();
module.exports = webSocketManager;
