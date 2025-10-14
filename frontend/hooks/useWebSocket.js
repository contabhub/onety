import { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import axios from 'axios';

export function useWebSocket() {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 10;
  const baseDelay = 1000; // 1 segundo

  // Função para fazer logout quando token inválido
  const handleInvalidToken = () => {
    console.log('❌ Token inválido, fazendo logout...');
    localStorage.removeItem('token');
    localStorage.removeItem('userData');
    
    // Redirecionar para login
    window.location.href = '/login';
  };

  const connectSocket = () => {
    const token = localStorage.getItem('token');
    const userData = JSON.parse(localStorage.getItem('userData') || '{}');
    const companyId = userData.EmpresaId || userData.empresaId || userData.empresa_id || userData.companyId || userData.company_id;

    if (!token) return null;

    console.log('🔄 Tentando conectar WebSocket...');
    console.log('🏢 EmpresaId/CompanyId do userData:', companyId);
    
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:5000';
    console.log('🔗 URL do WebSocket:', wsUrl);
    
    // Configuração específica para Ngrok - usa polling primeiro, depois upgrade para websocket
    const isNgrokUrl = wsUrl.includes('ngrok');
    const socketConfig = {
      auth: { token: `Bearer ${token}`, companyId },
      reconnection: false,
      timeout: 20000,
      forceNew: true,
      withCredentials: true,
      path: '/socket.io'
    };

    if (isNgrokUrl) {
      // Para Ngrok: usa polling primeiro (que funciona), depois faz upgrade para websocket
      socketConfig.transports = ['polling', 'websocket'];
      socketConfig.upgrade = true;
      // Header para pular página de aviso do Ngrok
      socketConfig.extraHeaders = {
        'ngrok-skip-browser-warning': 'true'
      };
      console.log('🔄 Usando configuração Ngrok: polling → websocket upgrade');
    } else {
      // Para localhost/produção: websocket direto
      socketConfig.transports = ['websocket'];
      console.log('⚡ Usando configuração direta: websocket');
    }

    const newSocket = io(wsUrl, socketConfig);

    // Eventos de conexão
    newSocket.on('connect', () => {
      console.log('✅ WebSocket conectado');
      setConnected(true);
      reconnectAttemptsRef.current = 0; // Reset contador de tentativas
      
      // Entrar na sala da empresa
      if (companyId) {
        newSocket.emit('join:company', Number(companyId));
        console.log('[WS] join:company enviado com empresaId/companyId =', companyId);
      }
    });

    // Após o servidor autenticar, ele envia user:connected com user.company_id
    // Mantemos o companyId do cliente como fonte de verdade (seleção atual)
    newSocket.on('user:connected', (data) => {
      try {
        const serverCompanyId = data?.user?.company_id;
        const userData = JSON.parse(localStorage.getItem('userData') || '{}');
        const localCompanyId = userData.EmpresaId || userData.empresaId || userData.empresa_id || userData.companyId || userData.company_id;

        console.log('[WS] user:connected recebido:', {
          serverCompanyId,
          localCompanyId,
          userData: {
            id: userData.id,
            email: userData.email,
            EmpresaId: userData.EmpresaId,
            EmpresaNome: userData.EmpresaNome
          }
        });

        if (serverCompanyId && String(serverCompanyId) !== String(localCompanyId)) {
          console.log('[WS] Info: companyId do servidor difere do local:', { serverCompanyId, localCompanyId });
        }
      } catch (err) {
        console.warn('[WS] Falha ao processar user:connected:', err?.message);
      }
    });

    newSocket.on('disconnect', (reason) => {
      console.log('❌ WebSocket desconectado:', reason);
      setConnected(false);
      
      // Tentar reconectar automaticamente
      if (reason === 'io server disconnect' || reason === 'io client disconnect') {
        console.log('🔄 Desconexão intencional, não tentando reconectar');
        return;
      }
      
      scheduleReconnect();
    });

    newSocket.on('connect_error', (error) => {
      console.error('❌ Erro na conexão WebSocket:', error);
      setConnected(false);
      
      // Se for erro de token inválido, forçar logout
      if (error.message === 'Token inválido' || error.message === 'Token de autenticação não fornecido') {
        handleInvalidToken();
        return;
      }
      
      // Tentar reconectar em caso de outros erros
      scheduleReconnect();
    });

    return newSocket;
  };

  const scheduleReconnect = () => {
    if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
      console.error('❌ Máximo de tentativas de reconexão atingido');
      return;
    }

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    const delay = Math.min(baseDelay * Math.pow(2, reconnectAttemptsRef.current), 30000); // Max 30 segundos
    reconnectAttemptsRef.current++;

    console.log(`🔄 Tentativa de reconexão ${reconnectAttemptsRef.current}/${maxReconnectAttempts} em ${delay}ms`);
    
    reconnectTimeoutRef.current = setTimeout(() => {
      const newSocket = connectSocket();
      if (newSocket) {
        setSocket(newSocket);
      }
    }, delay);
  };

  useEffect(() => {
    const currentSocket = connectSocket();
    if (currentSocket) {
      setSocket(currentSocket);
    }

    // Cleanup
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (currentSocket) {
        currentSocket.disconnect();
      }
    };
  }, []);

  return { socket, connected };
}
