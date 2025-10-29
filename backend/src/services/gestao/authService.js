const https = require("https");
const axios = require("axios");
require("dotenv").config();

const certificadoBase64 = require("../../config/certificado");

const CERT_PASSWORD = process.env.CERT_PASSWORD;
const CONSUMER_KEY = process.env.CONSUMER_KEY;
const CONSUMER_SECRET = process.env.CONSUMER_SECRET;

if (!certificadoBase64) {
  throw new Error("❌ Certificado Base64 não encontrado.");
}

const certBuffer = Buffer.from(certificadoBase64, "base64");

// 🛡️ Cria o agente HTTPS diretamente do buffer
let agent;

try {
  agent = new https.Agent({
    pfx: certBuffer,
    passphrase: CERT_PASSWORD,
    rejectUnauthorized: false, // opcional para testes
  });
} catch (err) {
  console.error("❌ Erro ao criar o agent HTTPS:", err.message);
  throw err;
}

const obterToken = async () => {

  try {
    const authHeader = Buffer.from(`${CONSUMER_KEY}:${CONSUMER_SECRET}`).toString("base64");

    const response = await axios.post(
      "https://autenticacao.sapi.serpro.gov.br/authenticate",
      new URLSearchParams({ grant_type: "client_credentials" }),
      {
        httpsAgent: agent,
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Authorization": `Basic ${authHeader}`,
          "Role-Type": "TERCEIROS",
        },
      }
    );

    return {
      accessToken: response.data.access_token,
      jwtToken: response.data.jwt_token || null
    };
  } catch (err) {
    console.error("❌ Erro ao obter token:", err.response?.data || err.message);
    return null;
  }
};

module.exports = { obterToken };
