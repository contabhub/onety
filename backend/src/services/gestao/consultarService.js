const axios = require("axios");
const { obterToken } = require("./authService");
const {
  obterTokenProcurador,
  armazenarTokenNoCache,
  autenticarViaCertificado
} = require("./authprocuradorService");
const { registrarRequisicaoSerpro } = require("./serproLogService");
const db = require("../../config/database");

const API_BASE_URL = "https://gateway.apiserpro.serpro.gov.br/integra-contador/v1";
const MEU_CNPJ = "17422651000172"; // Substitua pelo CNPJ da CF RJ

async function consultarServico(
  contratanteNumero,
  autorPedidoNumero,
  contribuinteNumero,
  idSistema,
  idServico,
  dados = {}
) {
  try {
    console.log("📞 Iniciando consultarServico()");
    console.log("📌 Dados recebidos:", {
      contratanteNumero,
      autorPedidoNumero,
      contribuinteNumero,
      idSistema,
      idServico,
      dados
    });

    const { accessToken, jwtToken } = await obterToken();
    console.log("🔑 Token principal obtido com sucesso.");

    if (idServico === "DIVIDAATIVA24" && !dados.anoCalendario) {
      dados.anoCalendario = new Date().getFullYear().toString();
    }

    const servicosSemDados = ["PEDIDOSPARC163", "PEDIDOSPARC203"];
    const dadosRequisicao = servicosSemDados.includes(idServico)
      ? ""
      : JSON.stringify(dados);

    let headers = {
      Authorization: `Bearer ${accessToken}`,
      jwt_token: jwtToken || "",
      "Content-Type": "application/json"
    };

    if (autorPedidoNumero !== MEU_CNPJ) {
      let procuradorToken = obterTokenProcurador(autorPedidoNumero);
      console.log("🔐 Procurador token cache:", procuradorToken ? "encontrado" : "não encontrado");

      if (!procuradorToken) {
        const cnpjBusca = autorPedidoNumero.replace(/\D/g, '');
        console.log("🔍 Buscando empresa com CNPJ:", cnpjBusca);
        const [[empresa]] = await db.query(`
          SELECT razaoSocial AS nome FROM empresas WHERE REPLACE(REPLACE(REPLACE(cnpj, '.', ''), '/', ''), '-', '') = ?
        `, [cnpjBusca]);
        console.log("🔍 Resultado da busca:", empresa);

        if (!empresa || !empresa.nome) {
          throw new Error(`❌ Nome da empresa não encontrado para o CNPJ ${autorPedidoNumero}`);
        }

        procuradorToken = await autenticarViaCertificado(
          contribuinteNumero,
          autorPedidoNumero,
          empresa.nome
        );

        if (procuradorToken?.procuradorToken) {
          procuradorToken = procuradorToken.procuradorToken;
          armazenarTokenNoCache(`procurador_token_${autorPedidoNumero}`, procuradorToken);
          console.log("🔐 Procurador token gerado e salvo no cache");
        } else {
          throw new Error(`❌ Erro ao obter o token do procurador para ${autorPedidoNumero}`);
        }
      }

      headers["autenticar_procurador_token"] = procuradorToken;
    }

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
        versaoSistema: "1.0",
        dados: dadosRequisicao
      }
    };

    console.log("📤 Enviando requisição para /Consultar com payload:");
    console.dir(requestBody, { depth: null });

    const response = await axios.post(`${API_BASE_URL}/Consultar`, requestBody, { headers });

    // Buscar empresa_id baseado no CNPJ
    const [[empresaLog]] = await db.query(`
      SELECT id FROM empresas 
      WHERE REPLACE(REPLACE(REPLACE(cnpj, '.', ''), '/', ''), '-', '') = ?
    `, [contratanteNumeroLimpo]);
    
    const empresaId = empresaLog?.id || 1;

    await registrarRequisicaoSerpro({
      empresaId,
      cnpjEmpresa: contratanteNumeroLimpo,
      tipoOperacao: "consulta",
      endpoint: "/Consultar",
      status: "success",
      detalhes: response.data
    });

    let dadosTratados = response.data.dados;
    if (typeof dadosTratados === "string") {
      const dadosTrim = dadosTratados.trim();

      if (dadosTrim && dadosTrim !== "undefined" && dadosTrim !== "null") {
        try {
          dadosTratados = JSON.parse(dadosTrim);
          console.log("✅ Dados tratados com sucesso.");
        } catch (err) {
          console.warn("⚠️ Erro ao fazer parse do campo 'dados':", dadosTrim);
          dadosTratados = null;
        }
      } else {
        dadosTratados = null;
      }
    }

    console.log("📬 Resposta final da API recebida com sucesso.");
    return {
      status: response.status,
      headers: response.headers,
      dados: dadosTratados,
      raw: response.data
    };

  } catch (error) {
    // Buscar empresa_id para log de erro
    const [[empresaLogErro]] = await db.query(`
      SELECT id FROM empresas 
      WHERE REPLACE(REPLACE(REPLACE(cnpj, '.', ''), '/', ''), '-', '') = ?
    `, [contratanteNumero.replace(/\D/g, '')]);
    
    const empresaIdErro = empresaLogErro?.id || 1;

    await registrarRequisicaoSerpro({
      empresaId: empresaIdErro,
      cnpjEmpresa: contratanteNumero.replace(/\D/g, ''),
      tipoOperacao: "consulta",
      endpoint: "/Consultar",
      status: "error",
      detalhes: error.response ? error.response.data : error.message
    });
    console.error("❌ Erro na consulta:", error.message);
    if (error.response) {
      console.error("📉 Status do erro:", error.response.status);
      console.error("📉 Dados do erro:", JSON.stringify(error.response.data, null, 2));
    } else if (error.request) {
      console.error("📡 Erro na requisição (sem resposta):", error.request);
    } else {
      console.error("⚙️ Erro ao configurar a requisição:", error.message);
    }
    throw new Error(error.response?.data?.mensagem || "Falha ao consultar serviço");
  }
}

module.exports = { consultarServico };
