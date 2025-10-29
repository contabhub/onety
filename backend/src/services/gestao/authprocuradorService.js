const axios = require("axios");
const { obterToken } = require("./authService");
const db = require("../../config/database"); // se ainda não estiver importado

const API_INTERMEDIARIA_URL = "https://planilha.cffranquias.com.br/integra/gerar_autorizacao.php";
const API_SERPRO_URL = "https://gateway.apiserpro.serpro.gov.br/integra-contador/v1/Apoiar"; // Substitua pelo endpoint correto
const MEU_CNPJ = "17422651000172"; // CF RJ

const cache = {}; // Cache para armazenar tokens temporários

// 🔹 Função para recuperar token do cache
function obterTokenProcurador(cnpjAutorPedido) {
    return cache[`procurador_token_${cnpjAutorPedido}`] || null;
}


// 🔹 Função para armazenar token no cache
function armazenarTokenNoCache(chave, valor) {
    cache[chave] = valor;
    console.log(`✅ Token armazenado no cache: ${chave} => ${valor}`);
    console.log("📦 Estado atual do cache:", JSON.stringify(cache, null, 2));
}

// 🔹 Função para determinar se é CNPJ ou CPF
function determinarTipoDocumento(numero) {
    return numero.length === 14 ? "PJ" : "PF";
}

// 🔹 Gerar XML Assinado via API Intermediária
async function gerarCertificadoAssinado(cnpjAssinante, nomeAssinante) {
  try {
    if (!cnpjAssinante || cnpjAssinante.trim() === "") {
  throw new Error("❌ CNPJ do assinante está vazio. Verifique os parâmetros.");
}

    const cnpjLimpo = cnpjAssinante.replace(/\D/g, ""); // remove qualquer ponto, traço ou espaço
    const cnpjMascara = cnpjAssinante;


   // Tenta buscar sem máscara ou com máscara
   let [result] = await db.query(`
  SELECT pfx AS certificado_base64, senhaPfx AS senha_certificado
  FROM empresas
  WHERE cnpj = ? OR REPLACE(REPLACE(REPLACE(cnpj, '.', ''), '/', ''), '-', '') = ?
  LIMIT 1
`, [cnpjMascara, cnpjLimpo]);
const empresa = result && result[0] ? result[0] : result;


    if (!empresa || !empresa.certificado_base64 || !empresa.senha_certificado) {
      throw new Error("❌ Certificado ou senha não encontrados para o CNPJ informado.");
    }

    const payload = {
      certificado_base64: empresa.certificado_base64,
      senha_certificado: empresa.senha_certificado,
      assinante: {
        numero: cnpjLimpo, // sempre sem máscara!
        nome: nomeAssinante,
        tipo: "PJ",
        papel: "autor pedido de dados"
      }
    };


const response = await axios.post(API_INTERMEDIARIA_URL, payload, {
  headers: { "Content-Type": "application/json" }
});


if (response.data && (response.data.xml_base64 || response.data.xml_assinado_base64)) {
  console.log("✅ XML assinado gerado com sucesso.");
  const xmlFinal = response.data.xml_base64 || response.data.xml_assinado_base64;
  return xmlFinal;
} else {
  console.warn("⚠️ Nenhum campo xml_base64 ou xml_assinado_base64 encontrado na resposta.");
  throw new Error("❌ Resposta da API intermediária não contém XML assinado.");
}


  } catch (error) {
    if (error.response) {
      console.error(`❌ Erro na API (Status ${error.response.status}):`, error.response.data);
    } else {
      console.error("❌ Erro ao gerar certificado assinado:", error.message);
    }
    throw error;
  }
}

// 🔹 Autenticar no Serpro com XML Assinado
async function autenticarNoSerpro(certificadoAssinado, cnpjCliente, cnpjAutorPedido, cnpjContratante) {
    try {
        // Sempre envie CNPJ limpo para payloads externos
        const cnpjClienteLimpo = cnpjCliente.replace(/\D/g, '');
        const cnpjAutorPedidoLimpo = cnpjAutorPedido.replace(/\D/g, '');
        const cnpjContratanteLimpo = cnpjContratante.replace(/\D/g, '');

        console.log("📌 Enviando CNPJ do contribuinte (limpo):", cnpjClienteLimpo);
        console.log("📌 Contratante (limpo):", cnpjContratanteLimpo, "| AutorPedidoDados (limpo):", cnpjAutorPedidoLimpo);

        const { accessToken, jwtToken } = await obterToken();

        console.log("✅ Tokens obtidos com sucesso.");
        // Validação extra no CNPJ antes de enviar para API
        if (!cnpjClienteLimpo || typeof cnpjClienteLimpo !== "string" || cnpjClienteLimpo.length !== 14 || isNaN(cnpjClienteLimpo)) {
            throw new Error(`❌ CNPJ do contribuinte inválido: ${cnpjClienteLimpo}`);
        }

        const payload = {
            "contratante": { "numero": cnpjContratanteLimpo, "tipo": 2 },
            "autorPedidoDados": { "numero": cnpjAutorPedidoLimpo, "tipo": 2 },
            "contribuinte": { "numero": cnpjClienteLimpo, "tipo": 2 },
            "pedidoDados": {
                "idSistema": "AUTENTICAPROCURADOR",
                "idServico": "ENVIOXMLASSINADO81",
                "versaoSistema": "1.0",
                "dados": JSON.stringify({ xml: certificadoAssinado })
            }
        };

        console.log("🚀 Enviando certificado assinado para autenticação no Serpro...");
        console.log("📦 Payload final enviado:", JSON.stringify(payload, null, 2));

        const headers = {
            Authorization: `Bearer ${accessToken}`,
            jwt_token: jwtToken,
            "Content-Type": "application/json"
        };

        const response = await axios.post(API_SERPRO_URL, payload, { headers });

        console.log("✅ Resposta da API Serpro recebida!");
        

        // Captura e armazena o `etag` no cache
        if (response.headers && response.headers['etag']) {
            let etagValue = response.headers['etag'].replace(/"/g, ''); // Remove aspas duplas
            console.log(`📥 ETag bruto recebido: ${etagValue}`);

            // Armazena o `etag` completo para inspeção
            armazenarTokenNoCache(`etag_bruto_${cnpjAutorPedidoLimpo}`, etagValue);

            if (etagValue.startsWith("autenticar_procurador_token:")) {
                let procuradorToken = etagValue.split(":")[1]; // Extrai o token após ":"
                console.log(`✅ Token do Procurador extraído: ${procuradorToken}`);

                // Armazena o token no cache
                armazenarTokenNoCache(`procurador_token_${cnpjAutorPedidoLimpo}`, procuradorToken);
            }
        }
        
        return { status: "Sucesso" };
    } catch (error) {
        const cnpjAutorPedidoLimpo = cnpjAutorPedido ? cnpjAutorPedido.replace(/\D/g, '') : '';
        if (error.response && error.response.status === 304) {
            console.warn("⚠️ Resposta 304: Dados não modificados, recuperando do cache...");

            console.log("📥 Headers completos da resposta 304:", JSON.stringify(error.response.headers, null, 2));

            let etagBruto = error.response.headers['etag'];

            if (etagBruto) {
                etagBruto = etagBruto.replace(/"/g, ''); // Remove aspas duplas
                console.log(`📥 ETag extraído do erro 304: ${etagBruto}`);

                armazenarTokenNoCache(`etag_bruto_${cnpjAutorPedidoLimpo}_304`, etagBruto);

                if (etagBruto.startsWith("autenticar_procurador_token:")) {
                    let procuradorToken = etagBruto.split(":")[1];
                    console.log(`✅ Token do Procurador extraído do erro 304: ${procuradorToken}`);

                    armazenarTokenNoCache(`procurador_token_${cnpjAutorPedidoLimpo}`, procuradorToken);
                    return { procuradorToken };
                }
            }

            throw new Error("❌ Nenhum Token do Procurador encontrado no cache.");
        }

        console.error("❌ Erro ao autenticar no Serpro:", error.response ? error.response.data : error.message);
        return null;
    }
}

// 🔹 Fluxo completo: Gera o certificado e autentica no Serpro
async function autenticarViaCertificado(cnpjCliente, cnpjAssinante, nomeAssinante) {
  try {

    const certificadoAssinado = await gerarCertificadoAssinado(cnpjAssinante, nomeAssinante);

    const cnpjContratante = MEU_CNPJ;
    const cnpjAutorPedido = cnpjAssinante;

    const result = await autenticarNoSerpro(certificadoAssinado, cnpjCliente, cnpjAutorPedido, cnpjContratante);

    if (!result || !result.procuradorToken) {
      throw new Error("❌ Erro ao obter o Token do Procurador.");
    }

    return result;
  } catch (error) {
    console.error('❌ Erro no processo de autenticação via certificado:', error.message);
    return null;
  }
}



module.exports = { 
    obterTokenProcurador, 
    armazenarTokenNoCache, 
    autenticarViaCertificado, 
    cache 
};
