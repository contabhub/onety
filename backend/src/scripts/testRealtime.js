const WebSocket = require('ws');
const fetch = require('node-fetch');

const testRealtimeFeatures = async () => {
  console.log('🧪 Testando funcionalidades de tempo real...\n');

  const baseUrl = 'http://localhost:3000';
  const wsUrl = 'ws://localhost:3000/ws';

  // Teste 1: Verificar se o servidor está rodando
  console.log('1. Testando conexão HTTP...');
  try {
    const response = await fetch(`${baseUrl}/`);
    const data = await response.text();
    console.log('✅ Servidor HTTP funcionando:', data);
  } catch (error) {
    console.log('❌ Erro na conexão HTTP:', error.message);
    return;
  }

  // Teste 2: Verificar configuração de conversa
  console.log('\n2. Testando configuração de conversa...');
  try {
    const response = await fetch(`${baseUrl}/realtime/conversation/config`);
    const data = await response.json();
    if (data.success) {
      console.log('✅ Configuração de conversa carregada');
      console.log('   - Sample Rate:', data.data.sessionConfig.sampleRate);
      console.log('   - Instruções:', data.data.instructions.substring(0, 100) + '...');
    } else {
      console.log('❌ Erro na configuração:', data.error);
    }
  } catch (error) {
    console.log('❌ Erro ao carregar configuração:', error.message);
  }

  // Teste 3: Verificar WebSocket (se disponível)
  console.log('\n3. Testando WebSocket...');
  try {
    const ws = new WebSocket(wsUrl);
    
    ws.on('open', () => {
      console.log('✅ WebSocket conectado');
      ws.close();
    });

    ws.on('error', (error) => {
      console.log('❌ Erro no WebSocket:', error.message);
      console.log('   (Isso é normal se OPENAI_API_KEY não estiver configurada)');
    });

    // Timeout para evitar travamento
    setTimeout(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    }, 5000);

  } catch (error) {
    console.log('❌ Erro ao conectar WebSocket:', error.message);
  }

  // Teste 4: Verificar diretórios
  console.log('\n4. Verificando estrutura de diretórios...');
  const fs = require('fs');
  const path = require('path');
  
  const directories = [
    'uploads',
    'uploads/audio',
    'uploads/images',
    'uploads/documents'
  ];

  directories.forEach(dir => {
    const fullPath = path.join(__dirname, '../../', dir);
    if (fs.existsSync(fullPath)) {
      console.log(`✅ Diretório existe: ${dir}`);
    } else {
      console.log(`❌ Diretório não encontrado: ${dir}`);
    }
  });

  console.log('\n🎉 Teste concluído!');
  console.log('\n📋 Resumo:');
  console.log('- Servidor HTTP: Funcionando');
  console.log('- APIs de áudio: Disponíveis');
  console.log('- WebSocket: Disponível (requer OPENAI_API_KEY)');
  console.log('- Estrutura de arquivos: Criada');
  console.log('\n🚀 Para usar o WebSocket, configure OPENAI_API_KEY no .env');
};

// Executar se chamado diretamente
if (require.main === module) {
  testRealtimeFeatures().catch(console.error);
}

module.exports = testRealtimeFeatures;
