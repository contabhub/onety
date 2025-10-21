const express = require("express");
const router = express.Router();
const verifyToken = require("../middlewares/auth");
const { getPluggyApiKey, forceNewPluggyApiKey, makePluggyRequest } = require("../middlewares/pluggyToken");

// 🔑 GET /pluggy-token/status - Verificar status do token atual
router.get("/status", verifyToken, async (req, res) => {
  try {
    console.log("[Pluggy Token Manager] Verificando status do token...");
    
    const apiKey = await getPluggyApiKey();
    
    // Testar se o token está funcionando
    try {
      await makePluggyRequest("https://api.pluggy.ai/connectors");
      console.log("[Pluggy Token Manager] Token está funcionando!");
      
      res.json({
        success: true,
        message: "Token Pluggy está funcionando corretamente",
        tokenPreview: apiKey.substring(0, 10) + "...",
        status: "ativo"
      });
    } catch (error) {
      console.log("[Pluggy Token Manager] Token não está funcionando:", error?.response?.status);
      
      res.json({
        success: false,
        message: "Token Pluggy não está funcionando",
        error: error?.response?.data || error.message,
        status: "inativo"
      });
    }
    
  } catch (error) {
    console.error("[Pluggy Token Manager] Erro ao verificar status:", error);
    res.status(500).json({
      success: false,
      message: "Erro ao verificar status do token",
      error: error.message
    });
  }
});

// 🔄 POST /pluggy-token/regenerate - Forçar regeneração do token
router.post("/regenerate", verifyToken, async (req, res) => {
  try {
    console.log("[Pluggy Token Manager] Forçando regeneração do token...");
    
    const newApiKey = await forceNewPluggyApiKey();
    
    // Testar o novo token
    try {
      await makePluggyRequest("https://api.pluggy.ai/connectors");
      console.log("[Pluggy Token Manager] Novo token está funcionando!");
      
      res.json({
        success: true,
        message: "Token Pluggy regenerado com sucesso",
        tokenPreview: newApiKey.substring(0, 10) + "...",
        status: "regenerado"
      });
    } catch (error) {
      console.log("[Pluggy Token Manager] Novo token não está funcionando:", error?.response?.status);
      
      res.json({
        success: false,
        message: "Token regenerado mas não está funcionando",
        error: error?.response?.data || error.message,
        status: "erro"
      });
    }
    
  } catch (error) {
    console.error("[Pluggy Token Manager] Erro ao regenerar token:", error);
    res.status(500).json({
      success: false,
      message: "Erro ao regenerar token",
      error: error.message
    });
  }
});

// 🧪 POST /pluggy-token/test - Testar token com uma requisição específica
router.post("/test", verifyToken, async (req, res) => {
  const { url = "https://api.pluggy.ai/connectors" } = req.body;
  
  try {
    console.log(`[Pluggy Token Manager] Testando token com URL: ${url}`);
    
    const response = await makePluggyRequest(url);
    
    res.json({
      success: true,
      message: "Teste realizado com sucesso",
      url: url,
      statusCode: response.status,
      dataPreview: JSON.stringify(response.data).substring(0, 200) + "..."
    });
    
  } catch (error) {
    console.error("[Pluggy Token Manager] Erro no teste:", error);
    res.status(500).json({
      success: false,
      message: "Erro no teste do token",
      error: error?.response?.data || error.message,
      statusCode: error?.response?.status
    });
  }
});

module.exports = router; 