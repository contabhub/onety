const axios = require('axios');
const { obterToken } = require('./authService');
const {
  obterTokenProcurador,
  armazenarTokenNoCache,
  autenticarViaCertificado
} = require('./authprocuradorService');
const db = require("../../config/database");
const { registrarRequisicaoSerpro } = require("./serproLogService");

const API_BASE_URL = 'https://gateway.apiserpro.serpro.gov.br/integra-contador/v1';

/**
 * Faz uma solicitação ao serviço `/Apoiar`, retornando um protocolo de requisição.
 * O tipo de serviço é definido pelo `idSistema` e `idServico`.
 */
async function solicitarProtocolo(contratanteNumero, autorPedidoNumero, contribuinteNumero, idSistema, idServico) {
  try {
    const { accessToken, jwtToken } = await obterToken();

    console.log("🔑 Token obtido:", accessToken);
    console.log("🔒 JWT Token:", jwtToken);

    let headers = {
      'Authorization': `Bearer ${accessToken}`,
      'jwt_token': jwtToken,
      'Content-Type': 'application/json'
    };

    console.log("📢 Verificando headers antes do envio:", headers);
    console.log("📢 Verificando funções importadas:", { obterTokenProcurador, autenticarViaCertificado });

    if (autorPedidoNumero !== "17422651000172") {
      let procuradorToken = obterTokenProcurador(autorPedidoNumero);

      if (!procuradorToken) {
        console.log(`🔄 Nenhum token encontrado para ${autorPedidoNumero}. Gerando novo...`);

        // 🔍 Buscar nome da empresa com base no CNPJ
        const [[empresa]] = await db.query(`
          SELECT razaoSocial AS nome
          FROM empresas
          WHERE REPLACE(REPLACE(REPLACE(cnpj, '.', ''), '/', ''), '-', '') = ?
        `, [autorPedidoNumero.replace(/\D/g, '')]);

        if (!empresa || !empresa.nome) {
          throw new Error(`❌ Nome da empresa não encontrado para o CNPJ ${autorPedidoNumero}`);
        }

        // 🔐 Autenticação via certificado com dados reais
        procuradorToken = await autenticarViaCertificado(
          contribuinteNumero,
          autorPedidoNumero,
          empresa.nome
        );

        console.log("🔍 Token do procurador retornado pela autenticação:", procuradorToken);

        if (procuradorToken && procuradorToken.procuradorToken) {
          procuradorToken = procuradorToken.procuradorToken;
          armazenarTokenNoCache(`procurador_token_${autorPedidoNumero}`, procuradorToken);
        } else {
          throw new Error(`❌ Erro ao obter o token do procurador para ${autorPedidoNumero}`);
        }
      }

      console.log(`✅ Token do Procurador final para ${autorPedidoNumero}:`, procuradorToken);
      headers['autenticar_procurador_token'] = procuradorToken;
    }

    console.log("📢 Headers finais antes do envio:", headers);

    // Sempre envie CNPJ limpo para payloads externos
    const contratanteNumeroLimpo = contratanteNumero.replace(/\D/g, '');
    const autorPedidoNumeroLimpo = autorPedidoNumero.replace(/\D/g, '');
    const contribuinteNumeroLimpo = contribuinteNumero.replace(/\D/g, '');

    const requestBody = {
      contratante: { numero: contratanteNumeroLimpo, tipo: 2 },
      autorPedidoDados: { numero: autorPedidoNumeroLimpo, tipo: 2 },
      contribuinte: {
        numero: contribuinteNumeroLimpo,
        tipo: contribuinteNumeroLimpo.length === 14 ? 2 : 1
      },
      pedidoDados: {
        idSistema,
        idServico,
        versaoSistema: "2.0",
        dados: ""
      }
    };

    console.log("📤 Enviando requisição para /Apoiar:", JSON.stringify(requestBody, null, 2));

    // Buscar empresa_id baseado no CNPJ
    const [[empresaLog]] = await db.query(`
      SELECT id FROM empresas 
      WHERE REPLACE(REPLACE(REPLACE(cnpj, '.', ''), '/', ''), '-', '') = ?
    `, [autorPedidoNumeroLimpo]);
    
    const empresaId = empresaLog?.id || 1;

    // Registrar requisição antes do envio
    await registrarRequisicaoSerpro({
      empresaId,
      cnpjEmpresa: autorPedidoNumeroLimpo,
      tipoOperacao: "apoio",
      endpoint: "/Apoiar",
      status: "enviando",
      detalhes: { idSistema, idServico }
    });

    const response = await axios.post(`${API_BASE_URL}/Apoiar`, requestBody, { headers });

    console.log("✅ Resposta da API:", response.data);

    // Atualizar status para sucesso
    await registrarRequisicaoSerpro({
      empresaId,
      cnpjEmpresa: autorPedidoNumeroLimpo,
      tipoOperacao: "apoio",
      endpoint: "/Apoiar",
      status: "sucesso",
      detalhes: response.data
    });

    if (response.data.dados) {
      const parsedData = JSON.parse(response.data.dados);
      if (parsedData.protocoloRelatorio) {
        console.log("📜 Protocolo Obtido (Body):", parsedData.protocoloRelatorio);
        return { protocolo: parsedData.protocoloRelatorio };
      }
    }

    throw new Error("❌ Protocolo não encontrado na resposta da API");

  } catch (error) {
    if (error.response && error.response.status === 304) {
      console.warn("⚠️ Resposta 304 recebida. Tentando extrair protocolo do header `etag`...");

      let etagBruto = error.response.headers['etag'];
      console.log("📌 ETag recebido bruto:", etagBruto);

      if (etagBruto) {
        etagBruto = etagBruto.replace(/"/g, "");
        console.log(`📥 ETag extraído: ${etagBruto}`);

        if (etagBruto.startsWith("protocoloRelatorio:")) {
          let protocolo = etagBruto.split(":")[1].trim();
          console.log(`✅ Protocolo obtido do etag: ${protocolo}`);
          return { protocolo, headers: error.response.headers };
        }
      }

      console.error("❌ Nenhum protocolo encontrado no `etag`.");
      throw new Error("304 Not Modified - Nenhum protocolo novo disponível.");
    }

    console.error("❌ Erro ao solicitar protocolo:", error.message);
    
    // Buscar empresa_id para log de erro
    const [[empresaLogErro]] = await db.query(`
      SELECT id FROM empresas 
      WHERE REPLACE(REPLACE(REPLACE(cnpj, '.', ''), '/', ''), '-', '') = ?
    `, [autorPedidoNumero.replace(/\D/g, '')]);
    
    const empresaIdErro = empresaLogErro?.id || 1;

    // Registrar erro
    await registrarRequisicaoSerpro({
      empresaId: empresaIdErro,
      cnpjEmpresa: autorPedidoNumero.replace(/\D/g, ''),
      tipoOperacao: "apoio",
      endpoint: "/Apoiar",
      status: "erro",
      detalhes: error.message
    });
    
    throw new Error(error.message || "Falha ao solicitar protocolo");
  }
}

module.exports = { solicitarProtocolo };
