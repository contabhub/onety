const axios = require("axios");

// 🗝️ Variáveis Pluggy
const clientId = process.env.PLUGGY_CLIENT_ID;
const clientSecret = process.env.PLUGGY_CLIENT_SECRET;

// 🔐 Cache da API KEY Pluggy
let pluggyApiKey = null;
let pluggyApiKeyExpiresAt = null;

// 🔑 Função para gerar e cachear a API KEY
async function getPluggyApiKey() {
  const now = new Date();
  if (pluggyApiKey && pluggyApiKeyExpiresAt > now) {
    console.log("[Pluggy] Usando API KEY em cache");
    return pluggyApiKey;
  }

  console.log("[Pluggy] Gerando nova API KEY");
  const { data } = await axios.post("https://api.pluggy.ai/auth", { clientId, clientSecret });

  pluggyApiKey = data.apiKey;
  pluggyApiKeyExpiresAt = new Date(now.getTime() + 23 * 60 * 60 * 1000);
  console.log("[Pluggy] Nova API KEY gerada");
  return pluggyApiKey;
}

// 🔑 Função para forçar geração de nova API KEY (sem cache)
async function forceNewPluggyApiKey() {
  console.log("[Pluggy] Forçando geração de nova API KEY");
  const { data } = await axios.post("https://api.pluggy.ai/auth", { clientId, clientSecret });
  
  // Atualizar cache
  pluggyApiKey = data.apiKey;
  pluggyApiKeyExpiresAt = new Date(new Date().getTime() + 23 * 60 * 60 * 1000);
  
  console.log("[Pluggy] Nova API KEY forçada gerada");
  return pluggyApiKey;
}

// 🔄 Função para fazer requisição com retry automático
async function makePluggyRequest(url, options = {}) {
  let attempts = 0;
  const maxAttempts = 2;

  while (attempts < maxAttempts) {
    try {
      attempts++;
      console.log(`[Pluggy] Tentativa ${attempts} de ${maxAttempts}`);
      
      const apiKey = await getPluggyApiKey();
      console.log(`[Pluggy] API KEY utilizada: ${apiKey.substring(0, 10)}...`);
      
      const response = await axios.get(url, {
        headers: { "X-API-KEY": apiKey, ...options.headers },
        ...options
      });
      
      console.log(`[Pluggy] Requisição bem-sucedida na tentativa ${attempts}`);
      return response;
      
    } catch (error) {
      console.error(`[Pluggy] Erro na tentativa ${attempts}:`, error?.response?.data || error.message);
      
      // Se for erro 403 (token inválido) e não for a última tentativa
      if (error?.response?.status === 403 && attempts < maxAttempts) {
        console.log("[Pluggy] Token inválido detectado, forçando nova geração...");
        
        // Forçar nova geração de token
        await forceNewPluggyApiKey();
        
        // Aguardar um pouco antes da próxima tentativa
        await new Promise(resolve => setTimeout(resolve, 1000));
        continue;
      }
      
      // Se chegou aqui, é o último erro ou não é erro 403
      throw error;
    }
  }
}

// 🔄 Função para fazer requisição POST com retry automático
async function makePluggyPostRequest(url, data, options = {}) {
  let attempts = 0;
  const maxAttempts = 2;

  while (attempts < maxAttempts) {
    try {
      attempts++;
      console.log(`[Pluggy] Tentativa ${attempts} de ${maxAttempts} (POST)`);
      
      const apiKey = await getPluggyApiKey();
      console.log(`[Pluggy] API KEY utilizada: ${apiKey.substring(0, 10)}...`);
      
      const response = await axios.post(url, data, {
        headers: { "X-API-KEY": apiKey, ...options.headers },
        ...options
      });
      
      console.log(`[Pluggy] Requisição POST bem-sucedida na tentativa ${attempts}`);
      return response;
      
    } catch (error) {
      console.error(`[Pluggy] Erro na tentativa ${attempts} (POST):`, error?.response?.data || error.message);
      
      // Se for erro 403 (token inválido) e não for a última tentativa
      if (error?.response?.status === 403 && attempts < maxAttempts) {
        console.log("[Pluggy] Token inválido detectado, forçando nova geração...");
        
        // Forçar nova geração de token
        await forceNewPluggyApiKey();
        
        // Aguardar um pouco antes da próxima tentativa
        await new Promise(resolve => setTimeout(resolve, 1000));
        continue;
      }
      
      // Se chegou aqui, é o último erro ou não é erro 403
      throw error;
    }
  }
}

// 🔄 Função para fazer requisição PUT com retry automático
async function makePluggyPutRequest(url, data, options = {}) {
  let attempts = 0;
  const maxAttempts = 2;

  while (attempts < maxAttempts) {
    try {
      attempts++;
      console.log(`[Pluggy] Tentativa ${attempts} de ${maxAttempts} (PUT)`);
      
      const apiKey = await getPluggyApiKey();
      console.log(`[Pluggy] API KEY utilizada: ${apiKey.substring(0, 10)}...`);
      
      const response = await axios.put(url, data, {
        headers: { "X-API-KEY": apiKey, ...options.headers },
        ...options
      });
      
      console.log(`[Pluggy] Requisição PUT bem-sucedida na tentativa ${attempts}`);
      return response;
      
    } catch (error) {
      console.error(`[Pluggy] Erro na tentativa ${attempts} (PUT):`, error?.response?.data || error.message);
      
      // Se for erro 403 (token inválido) e não for a última tentativa
      if (error?.response?.status === 403 && attempts < maxAttempts) {
        console.log("[Pluggy] Token inválido detectado, forçando nova geração...");
        
        // Forçar nova geração de token
        await forceNewPluggyApiKey();
        
        // Aguardar um pouco antes da próxima tentativa
        await new Promise(resolve => setTimeout(resolve, 1000));
        continue;
      }
      
      // Se chegou aqui, é o último erro ou não é erro 403
      throw error;
    }
  }
}

module.exports = {
  getPluggyApiKey,
  forceNewPluggyApiKey,
  makePluggyRequest,
  makePluggyPostRequest,
  makePluggyPutRequest
}; 