const axios = require("axios");
const { obterToken } = require("./authService");

async function consultarTributacaoDetalhada(cnpj) {
    const { accessToken } = await obterToken();
  
    const headers = {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    };
  
    const url = `https://gateway.apiserpro.serpro.gov.br/consulta-cnpj-df/v2/empresa/${cnpj}`;
  
    try {
      const response = await axios.get(url, { headers });
      const dados = response.data;
  
      console.log("📦 Dados retornados da consulta CNPJ:", JSON.stringify(dados, null, 2));
  
      const simples = dados?.informacoesAdicionais?.optanteSimples?.toUpperCase?.() === "SIM";
      const mei = dados?.informacoesAdicionais?.optanteMei?.toUpperCase?.() === "SIM";
  
      const regime = mei
        ? "MEI"
        : simples
        ? "Simples Nacional"
        : "Lucro Presumido/Real";
  
      return {
        regime,
        dadosCompletos: dados
      };
    } catch (error) {
      console.error("❌ Erro na API de tributação:", error.response?.data || error.message);
      throw new Error("Erro ao consultar regime tributário via Serpro.");
    }
  }
  

module.exports = { consultarTributacaoDetalhada };
