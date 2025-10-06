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
    console.log('🔧 Inicializando WebSocket...');
    
    this.io = new Server(server, {
      cors: {
        origin: process.env.FRONTEND_URL || "http://localhost:3000",
        methods: ["GET", "POST"],
        credentials: true
      },
      transports: ['websocket', 'polling']
    });

    console.log('🔧 Configurando middleware...');
    this.setupMiddleware();
    
    console.log('🔧 Configurando event handlers...');
    this.setupEventHandlers();
    
    console.log('🚀 WebSocket inicializado com sucesso!');
  }

  /**
   * 🔐 Configura middleware de autenticação
   */
  setupMiddleware() {
// websocket/index.js (dentro de setupMiddleware)
this.io.use(async (socket, next) => {
  console.log('🔍 Tentativa de conexão WebSocket detectada');
  try {
    console.log('🔍 WebSocket middleware - Handshake recebido:', {
      auth: socket.handshake.auth,
      headers: socket.handshake.headers
    });
    
    const token = socket.handshake.auth.token || socket.handshake.headers.authorization;
    const requestedCompanyId = socket.handshake.auth.companyId
      ? Number(socket.handshake.auth.companyId)
      : null;
    
    console.log('🔑 Token encontrado:', token ? 'SIM' : 'NÃO');
    console.log('🏢 CompanyId solicitado:', requestedCompanyId);
    
    if (!token) {
      console.log('❌ Token não fornecido');
      return next(new Error('Token de autenticação não fornecido'));
    }

    // aceita com ou sem "Bearer "
    const cleanToken = token.replace('Bearer ', '');
    console.log('🔑 Token limpo:', cleanToken.substring(0, 20) + '...');

    // ✅ seu login assina { id, email } — não { userId }
    const decoded = jwt.verify(cleanToken, process.env.JWT_SECRET);
    const userId = decoded.id || decoded.userId; // fallback se no futuro mudar
    
    console.log('👤 User ID decodificado:', userId);

    // ✅ Buscar dados do usuário primeiro
    const [users] = await pool.query(
      'SELECT id, nome AS name, email FROM usuarios WHERE id = ? LIMIT 1',
      [userId]
    );
    if (users.length === 0) {
      return next(new Error('Usuário não encontrado'));
    }

    // ✅ WebSocket multiempresa: verifica se usuário tem acesso à empresa solicitada
    let companyId = null;
    
    console.log('🔍 Verificando acesso à empresa...');
    
    if (requestedCompanyId && Number.isFinite(requestedCompanyId)) {
      console.log(`🔍 Verificando se usuário ${userId} tem acesso à empresa ${requestedCompanyId}...`);
      
      // Verifica se o usuário tem acesso à empresa solicitada
      const [ucRequested] = await pool.query(
        'SELECT empresa_id FROM usuarios_empresas WHERE usuario_id = ? AND empresa_id = ? LIMIT 1',
        [userId, requestedCompanyId]
      );
      
      console.log('📊 Resultado da verificação de empresa:', ucRequested);
      
      if (ucRequested.length > 0) {
        companyId = requestedCompanyId;
        console.log(`✅ Usuário ${users[0].name} tem acesso à empresa ${companyId}`);
      } else {
        console.log(`❌ Usuário ${users[0].name} NÃO tem acesso à empresa ${requestedCompanyId}`);
        
        // Debug: mostrar todas as empresas do usuário
        const [allCompanies] = await pool.query(
          'SELECT empresa_id FROM usuarios_empresas WHERE usuario_id = ?',
          [userId]
        );
        console.log('🏢 Empresas disponíveis para o usuário:', allCompanies.map(c => c.empresa_id));
        
        return next(new Error(`Usuário não tem acesso à empresa ${requestedCompanyId}`));
      }
    } else {
      console.log(`❌ Empresa não especificada no handshake WebSocket`);
      return next(new Error('Empresa deve ser especificada no handshake'));
    }

    // Anexa os dados padronizados no socket
    socket.user = { ...users[0], company_id: companyId };
    socket.userId = users[0].id;

    next();
  } catch (error) {
    console.error('❌ Erro na autenticação WebSocket:', error.message);
    console.error('❌ Stack trace:', error.stack);
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

      // Handler para join em sala de empresa (multiempresa - pode estar em múltiplas empresas)
      socket.on('join:company', async (companyId) => {
        try {
          const targetCompanyId = Number(companyId);
          if (!Number.isFinite(targetCompanyId)) {
            console.warn(`❌ Empresa inválida: ${companyId}`);
            return;
          }

          // Valida se o usuário pertence à empresa solicitada
          const [rows] = await pool.query(
            'SELECT 1 FROM usuarios_empresas WHERE usuario_id = ? AND empresa_id = ? LIMIT 1',
            [socket.userId, targetCompanyId]
          );

          if (rows.length === 0) {
            console.warn(`🚫 Usuário ${socket.user.name} tentou entrar na empresa ${targetCompanyId} sem associação`);
            socket.emit('error', { message: `Sem acesso à empresa ${targetCompanyId}` });
            return;
          }

          // Entra na sala da empresa (pode estar em múltiplas empresas simultaneamente)
          socket.join(`company:${targetCompanyId}`);
          console.log(`🏢 Usuário ${socket.user.name} entrou na sala da empresa ${targetCompanyId}`);
          
          // Confirma entrada na sala
          socket.emit('joined:company', { companyId: targetCompanyId });
        } catch (err) {
          console.error('❌ Erro ao processar join:company:', err?.message || err);
          socket.emit('error', { message: 'Erro ao entrar na empresa' });
        }
      });

      // Handler para sair de sala de empresa específica
      socket.on('leave:company', (companyId) => {
        const targetCompanyId = Number(companyId);
        if (Number.isFinite(targetCompanyId)) {
          socket.leave(`company:${targetCompanyId}`);
          console.log(`🚪 Usuário ${socket.user.name} saiu da sala da empresa ${targetCompanyId}`);
          socket.emit('left:company', { companyId: targetCompanyId });
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
   * 🏢 Emite evento para uma empresa específica (multiempresa)
   */
  emitToCompany(companyId, event, data) {
    const room = `company:${companyId}`;
    this.emitToRoom(room, event, data);
  }

  /**
   * 🏢 Emite evento para múltiplas empresas
   */
  emitToCompanies(companyIds, event, data) {
    companyIds.forEach(companyId => {
      this.emitToCompany(companyId, event, data);
    });
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
