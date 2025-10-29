const axios = require('axios');
const { obterToken } = require('./authService');
const { obterTokenProcurador, armazenarTokenNoCache, autenticarViaCertificado } = require('./authprocuradorService');
const mysql = require('mysql2/promise');
const db = require("../../config/database"); // ✅ Correto agora
const { registrarRequisicaoSerpro } = require("./serproLogService");

const API_BASE_URL = 'https://gateway.apiserpro.serpro.gov.br/integra-contador/v1';

/**
 * 📌 Função para aguardar um tempo (em milissegundos)
 */
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 📌 Função para emitir o relatório e armazenar o Base64 no banco de dados
 */
async function emitirRelatorio(protocoloRelatorio, contratanteNumero, autorPedidoNumero, contribuinteNumero) {
    try {
        const { accessToken, jwtToken } = await obterToken();

        let headers = {
            'Authorization': `Bearer ${accessToken}`,
            'jwt_token': jwtToken || "",
            'Content-Type': 'application/json'
        };

        if (autorPedidoNumero !== "17422651000172") {
            let procuradorToken = obterTokenProcurador(autorPedidoNumero);
            if (!procuradorToken) {
                procuradorToken = await autenticarViaCertificado(
                    contribuinteNumero,
                    "ativo.pfx",
                    "Ativo@2024_",
                    autorPedidoNumero,
                    "ATIVO ADVISORY CONTABILIDADE LTDA"
                );

                if (procuradorToken?.procuradorToken) {
                    armazenarTokenNoCache(`procurador_token_${autorPedidoNumero}`, procuradorToken.procuradorToken);
                    procuradorToken = procuradorToken.procuradorToken;
                } else {
                    throw new Error(`❌ Erro ao obter o token do procurador para ${autorPedidoNumero}`);
                }
            }

            headers['autenticar_procurador_token'] = procuradorToken;
        }

        // Sempre envie CNPJ limpo para payloads externos
        const contratanteNumeroLimpo = contratanteNumero.replace(/\D/g, '');
        const autorPedidoNumeroLimpo = autorPedidoNumero.replace(/\D/g, '');
        const contribuinteNumeroLimpo = contribuinteNumero.replace(/\D/g, '');

        const requestBody = {
            "contratante": { "numero": contratanteNumeroLimpo, "tipo": 2 },
            "autorPedidoDados": { "numero": autorPedidoNumeroLimpo, "tipo": 2 },
            "contribuinte": {
                "numero": contribuinteNumeroLimpo,
                "tipo": contribuinteNumeroLimpo.length === 14 ? 2 : 1
            },
            "pedidoDados": {
                "idSistema": "SITFIS",
                "idServico": "RELATORIOSITFIS92",
                "versaoSistema": "2.0",
                "dados": `{ "protocoloRelatorio": "${protocoloRelatorio}" }`
            }
        };

        let tentativas = 0;
        const maxTentativas = 5;
        let tempoEspera = 4000;

        while (tentativas < maxTentativas) {
                    console.log(`📢 Tentativa ${tentativas + 1} de emissão do relatório...`);

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
          tipoOperacao: "emissao",
          endpoint: "/Emitir",
          status: "enviando",
          detalhes: { protocoloRelatorio, tentativa: tentativas + 1 }
        });

        const response = await axios.post(`${API_BASE_URL}/Emitir`, requestBody, { headers });

        console.log("✅ Resposta da API /Emitir:", response.data);

        // Atualizar status para sucesso
        await registrarRequisicaoSerpro({
          empresaId,
          cnpjEmpresa: autorPedidoNumeroLimpo,
          tipoOperacao: "emissao",
          endpoint: "/Emitir",
          status: "sucesso",
          detalhes: response.data
        });

            if (response.data.dados) {
                const parsedData = JSON.parse(response.data.dados);
            
                if (parsedData.pdf) {
                    const base64Data = parsedData.pdf;
            
                    console.log("📂 Base64 extraído com sucesso!");
            
                    return { 
                        message: "Relatório emitido com sucesso!",
                        protocolo: protocoloRelatorio,
                        base64: base64Data
                    };
                }
            
                if (parsedData.tempoEspera) {
                    console.log(`⏳ Relatório ainda em processamento. Aguardando ${parsedData.tempoEspera / 1000} segundos...`);
                    await delay(parsedData.tempoEspera);
                    tentativas++;
                    continue;
                }
            }
            

            console.log(`⚠️ Tentativa ${tentativas + 1} falhou. Aguardando ${tempoEspera / 1000} segundos antes de tentar novamente...`);
            await delay(tempoEspera);
            tentativas++;
        }

        throw new Error("❌ Relatório não foi gerado dentro do tempo esperado.");
    } catch (error) {
        console.error("❌ Erro ao emitir relatório:", error.message);
        
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
          tipoOperacao: "emissao",
          endpoint: "/Emitir",
          status: "erro",
          detalhes: error.message
        });
        
        throw new Error(error.message || "Falha ao emitir relatório");
    }
}

module.exports = { emitirRelatorio };
