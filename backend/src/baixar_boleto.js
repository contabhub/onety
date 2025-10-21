require('dotenv').config();
const fs = require('fs');
const axios = require('axios');
const https = require('https');

// 🔑 Pega os dados do .env
const clientId = process.env.INTER_CLIENT_ID;
const clientSecret = process.env.INTER_CLIENT_SECRET;
const certBuffer = Buffer.from(process.env.INTER_CERT_B64, 'base64');
const keyBuffer = Buffer.from(process.env.INTER_KEY_B64, 'base64');

// ⚠️ Substitua pelo codigoSolicitacao do boleto que quer baixar
const codigoSolicitacao = "b9c5ced8-c12e-454b-9282-544a3dd4924b";


// 🔐 Cria o agente HTTPS
const agent = new https.Agent({
  cert: certBuffer,
  key: keyBuffer,
  rejectUnauthorized: true
});

// 1️⃣ FUNÇÃO PARA GERAR TOKEN
async function gerarToken() {
  try {
    const resp = await axios.post(
      'https://cdpj.partners.bancointer.com.br/oauth/v2/token',
      new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'client_credentials',
        scope: 'boleto-cobranca.read boleto-cobranca.write'
      }),
      { httpsAgent: agent }
    );

    return resp.data.access_token;
  } catch (err) {
    console.error("❌ Erro ao gerar token:", err.response?.data || err.message);
    process.exit(1);
  }
}

// 2️⃣ FUNÇÃO PARA BAIXAR O PDF
async function baixarPDF(token) {
  try {
    const url = `https://cdpj.partners.bancointer.com.br/cobranca/v3/cobrancas/${codigoSolicitacao}/pdf`;

    const resp = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        'x-conta-corrente': '269127208'
      },
      httpsAgent: agent
    });

    if (resp.data.pdf) {
      fs.writeFileSync('boleto_inter.pdf', Buffer.from(resp.data.pdf, 'base64'));
      console.log('✅ PDF salvo como boleto_inter.pdf');
    } else {
      console.log("⚠️ PDF ainda não está pronto ou não veio no retorno.");
    }
  } catch (err) {
    console.error("❌ Erro ao baixar PDF:", err.response?.status, err.response?.data || err.message);
  }
}

// 🚀 EXECUÇÃO
(async () => {
  const token = await gerarToken();
  console.log("✅ Token gerado:", token);

  await baixarPDF(token);
})();
