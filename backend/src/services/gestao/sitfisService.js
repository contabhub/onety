const db = require("../../config/database");
const { consultarServico } = require("./consultarService");
const { emitirRelatorio } = require("./emitirService");
const { solicitarProtocolo } = require("./apoioService");
const pdfParse = require("pdf-parse");


async function extrairTextoDeBase64(base64) {
    const buffer = Buffer.from(base64, 'base64');
    const data = await pdfParse(buffer);
    return data.text;

    
}
const CONTRATANTE_CNPJ = "17422651000172"; // 🔹 CNPJ fixo da CF RJ

/**
 * 📌 Função para analisar a situação fiscal
 */
function analisarSituacao(texto) {
    const pendencias = [];

    if (/pend[eê]ncia.*d[eé]bito/i.test(texto)) pendencias.push("Débito");
    if (/diverg[eê]ncia.*GFIP.*GPS/i.test(texto)) pendencias.push("Divergência GFIP x GPS");
    if (/inscri[cç][aã]o.*d[ií]vida ativa|sida/i.test(texto)) pendencias.push("Dívida Ativa");
    if (/parcela.*em atraso|parcelamento.*em atraso/i.test(texto)) pendencias.push("Parcelamento em Atraso");
    if (/omiss[aã]o.*declara[cç][aã]o/i.test(texto)) pendencias.push("Omissão de Declaração");
    if (/processo fiscal/i.test(texto)) pendencias.push("Processo Fiscal");
    if (/arrolamento de bens/i.test(texto)) pendencias.push("Arrolamento de Bens");

    let status = "Regular";
    if (pendencias.length > 0) status = "Irregular";
    if (texto.includes("Certidão Positiva com Efeitos de Negativa")) status = "Regularizado";

    const descricao = pendencias.length > 0 ? pendencias.join(', ') : "Análise textual não identificou pendência específica.";

    return { status, descricao };
}

/**
 * 📌 Obtém o CNPJ da empresa antes de processar a Situação Fiscal
 */
async function obterCnpjEmpresa(empresaId) {
    try {
        const [result] = await db.execute(
            `SELECT cnpj FROM empresas WHERE id = ?`, 
            [empresaId]
        );

        if (result.length === 0) {
            throw new Error(`❌ Nenhuma empresa encontrada com ID ${empresaId}`);
        }

        return result[0].cnpj;
    } catch (error) {
        console.error("❌ Erro ao buscar CNPJ da empresa:", error);
        throw error;
    }
}

/**
 * 📌 Verifica se já existe um relatório gerado nos últimos 30 dias
 */
exports.verificarSitFis = async (empresaId, clienteId) => {
    try {
        const [result] = await db.execute(
            `SELECT * FROM sitfis 
             WHERE empresa_id = ? 
             AND cliente_id = ?
             AND data_criacao >= DATE_SUB(NOW(), INTERVAL 30 DAY)`,
            [empresaId, clienteId]
        );

        if (result.length > 0) {
            return result[0]; // Retorna os dados já armazenados
        }

        return null; // Indica que precisa gerar um novo relatório
    } catch (error) {
        console.error("❌ Erro ao verificar Situação Fiscal:", error);
        throw error;
    }
};

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 📌 Gera a Situação Fiscal, consultando e armazenando no banco
 */
exports.gerarSitFis = async (empresaId, clienteId, cnpjContribuinte) => {
    try {
        // 🔒 Bloqueio: se já existir SitFis neste mês para o cliente, não iniciar chamada ao SERPRO
        const [registroMes] = await db.execute(
            `SELECT id, data_criacao FROM sitfis 
             WHERE empresa_id = ? AND cliente_id = ? 
               AND MONTH(data_criacao) = MONTH(CURRENT_DATE()) 
               AND YEAR(data_criacao) = YEAR(CURRENT_DATE())
             LIMIT 1`,
            [empresaId, clienteId]
        );
        if (registroMes.length > 0) {
            console.log(`⏭️ SitFis já existente para cliente ${clienteId} no mês atual. Pulando emissão.`);
            return { skipped: true, reason: "SitFis já emitida no mês", createdAt: registroMes[0].data_criacao };
        }

        // 🔹 Obtém o CNPJ do autor do pedido (empresa relacionada)
        const autorPedidoCnpj = await obterCnpjEmpresa(empresaId);
        console.log(`🔍 CNPJ do autor do pedido: ${autorPedidoCnpj}`);

        // 🔹 Primeiro, consulta o protocolo do Serpro
        const consulta = await solicitarProtocolo (
            CONTRATANTE_CNPJ, // 🔹 Contratante fixo
            autorPedidoCnpj, // 🔹 Autor do pedido (CNPJ da empresa)
            cnpjContribuinte, // 🔹 CNPJ do contribuinte (cliente)
            "SITFIS", // 🔹 ID do sistema
            "RELATORIOSITFIS91" // 🔹 ID do serviço
        );

        if (!consulta || !consulta.protocoloRelatorio) {
            throw new Error("❌ Erro ao obter protocolo do relatório no Serpro.");
        }

        console.log("📜 Protocolo obtido:", consulta.protocoloRelatorio);

     // 🔹 Aguarda exatamente 30 segundos antes de prosseguir
     console.log("⏳ Aguardando 30 segundos antes de emitir o relatório...");
     await delay(3000); // 🔹 Delay de 30 segundos (agora garantido)

        // 🔹 Agora, usamos esse protocolo para emitir o relatório
        const relatorio = await emitirRelatorio(
            consulta.protocoloRelatorio,
            CONTRATANTE_CNPJ, // 🔹 Contratante fixo
            autorPedidoCnpj, // 🔹 Autor do pedido (CNPJ da empresa)
            cnpjContribuinte
        );

        if (!relatorio || !relatorio.fileName) {
            throw new Error("❌ Erro ao emitir relatório no Serpro.");
        }

        console.log("📂 Relatório salvo:", relatorio.fileName);

        // 🔹 Insere os dados no banco de dados
        await db.execute(
            `INSERT INTO sitfis (empresa_id, cliente_id, data_criacao, binary_file, status) 
             VALUES (?, ?, NOW(), ?, ?)`,
            [empresaId, clienteId, relatorio.fileName, "Regular"] // 🔹 Ajustar status conforme necessário
        );

        return { message: "Situação Fiscal gerada com sucesso!", fileName: relatorio.fileName };
    } catch (error) {
        console.error("❌ Erro ao gerar Situação Fiscal:", error);
        throw error;
    }
};

const processarSituacaoFiscalCliente = async (clienteId, empresaId, cnpjContribuinte) => {
    const contratanteNumero = "17422651000172";
    const [empresa] = await db.execute("SELECT cnpj FROM empresas WHERE id = ?", [empresaId]);
    const autorPedidoNumero = empresa[0].cnpj;

    // Função de tentativa com delay e retries
    async function tentarProcessar(retries = 3) {
        try {
            // Verifica se já existe um relatório no mês
            const [registroExistente] = await db.execute(
                `SELECT * FROM sitfis 
                WHERE empresa_id = ? 
                AND cliente_id = ? 
                AND MONTH(data_criacao) = MONTH(CURRENT_DATE()) 
                AND YEAR(data_criacao) = YEAR(CURRENT_DATE())`,
                [empresaId, clienteId]
            );

            if (registroExistente.length > 0) {
                console.log(`⏭️ Cliente ${clienteId} já consultado este mês.`);
                return;
            }

            const { protocolo } = await solicitarProtocolo(
                contratanteNumero,
                autorPedidoNumero,
                cnpjContribuinte,
                "SITFIS",
                "SOLICITARPROTOCOLO91"
            );

            // Delay antes de continuar
            await delay(500); // Espera 5 segundos entre requisições

            // Tentando obter o relatório
            const emitirRelatorioComRetry = async (retries) => {
                try {
                    const emissao = await emitirRelatorio(protocolo, contratanteNumero, autorPedidoNumero, cnpjContribuinte);
                    if (!emissao || !emissao.base64) {
                        throw new Error("Erro ao emitir relatório");
                    }
                    return emissao;
                } catch (error) {
                    if (retries > 0) {
                        console.log(`🔄 Tentando emitir relatório novamente... Tentativas restantes: ${retries}`);
                        await delay(5000); // Delay entre tentativas
                        return emitirRelatorioComRetry(retries - 1);
                    } else {
                        throw new Error("Máximo de tentativas atingido para emissão do relatório.");
                    }
                }
            };

            // Tentar emitir o relatório com retry
            const emissao = await emitirRelatorioComRetry(3);
            const textoExtraido = await extrairTextoDeBase64(emissao.base64);
            const { status, descricao } = analisarSituacao(textoExtraido);

            await db.execute(
                `INSERT INTO sitfis (cliente_id, empresa_id, binary_file, status, pendencias, data_criacao)
                VALUES (?, ?, ?, ?, ?, NOW())`,
                [clienteId, empresaId, emissao.base64, status, descricao]
            );

            console.log(`✅ Situação Fiscal do cliente ${clienteId} processada com sucesso.`);
        } catch (error) {
            console.error(`❌ Erro ao processar cliente ${clienteId}:`, error.message);
            if (retries > 0) {
                console.log(`🔄 Tentando novamente... Tentativas restantes: ${retries}`);
                await delay(3000); // Delay de 3 segundos antes de tentar novamente
                await tentarProcessar(retries - 1);
            } else {
                console.log("❌ Máximo de tentativas atingido. Não foi possível processar a situação fiscal.");
            }
        }
    }

    // Chama a função para tentar processar
    await tentarProcessar();
};


module.exports = { obterCnpjEmpresa, processarSituacaoFiscalCliente, extrairTextoDeBase64, analisarSituacao
};