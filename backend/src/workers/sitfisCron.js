const cron = require('node-cron');
const db = require('../config/database');
const { solicitarProtocolo } = require('../services/gestao/apoioService');
const { emitirRelatorio } = require('../services/gestao/emitirService');
const { consultarDCTFWeb } = require('../services/gestao/dctfwebService'); // Função DCTF Web
const pdfParse = require('pdf-parse');

// Função para extrair texto de PDF base64
async function extrairTextoDeBase64(base64) {
    const buffer = Buffer.from(base64, 'base64');
    const data = await pdfParse(buffer);
    return data.text;
}

// Função para analisar a situação fiscal
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

// Cron job para verificação mensal
cron.schedule('0 8 1 * *', async () => {
    console.log("🚀 Executando verificação mensal de situação fiscal...");

    try {
        const [empresas] = await db.execute("SELECT id, cnpj FROM empresas");

        for (const empresa of empresas) {
            const empresaId = empresa.id;
            const autorPedidoNumero = empresa.cnpj;
            const contratanteNumero = "17422651000172";

            const [clientes] = await db.execute(
                "SELECT id, cnpjCpf FROM clientes WHERE empresaId = ?",
                [empresaId]
            );

            for (const cliente of clientes) {
                const clienteId = cliente.id;
                const cnpjContribuinte = cliente.cnpjCpf;

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
                    continue;
                }

                try {
                    // 🔒 Bloqueio: pular se já existe SitFis no mês para este cliente
                    const [registroExistente] = await db.execute(
                        `SELECT id FROM sitfis 
                         WHERE empresa_id = ? AND cliente_id = ?
                           AND MONTH(data_criacao) = MONTH(CURRENT_DATE())
                           AND YEAR(data_criacao) = YEAR(CURRENT_DATE())
                         LIMIT 1`,
                        [empresaId, clienteId]
                    );
                    if (registroExistente.length > 0) {
                        console.log(`⏭️ [CRON] Cliente ${clienteId} já possui SitFis no mês. Não inicia SERPRO.`);
                        continue;
                    }

                    // 1. Solicita o protocolo para a Situação Fiscal
                    const { protocolo } = await solicitarProtocolo(
                        contratanteNumero,
                        autorPedidoNumero,
                        cnpjContribuinte,
                        "SITFIS",
                        "SOLICITARPROTOCOLO91"
                    );

                    if (!protocolo) throw new Error("Protocolo não encontrado.");

                    // 2. Emite o relatório de Situação Fiscal
                    const emissao = await emitirRelatorio(
                        protocolo,
                        contratanteNumero,
                        autorPedidoNumero,
                        cnpjContribuinte
                    );

                    if (!emissao || !emissao.base64) throw new Error("Erro ao emitir relatório.");

                    // 3. Extrai o texto do PDF base64
                    const textoExtraido = await extrairTextoDeBase64(emissao.base64);
                    const { status, descricao } = analisarSituacao(textoExtraido);

                    // 4. Armazena o resultado da Situação Fiscal no banco
                    await db.execute(
                        "INSERT INTO sitfis (cliente_id, empresa_id, binary_file, status, pendencias, data_criacao) VALUES (?, ?, ?, ?, ?, NOW())",
                        [clienteId, empresaId, emissao.base64, status, descricao]
                    );

                    console.log(`✅ Cliente ${clienteId} processado com sucesso.`);

                    // 5. Consulta DCTF Web após Situação Fiscal
                    const categoria = "GERAL_MENSAL";  // Ajuste conforme os dados do cliente
                    const anoPA = new Date().getFullYear().toString();  // Ano atual
                    const mesPA = (new Date().getMonth() + 1).toString().padStart(2, '0');  // Mês atual (com 2 dígitos)

                    const xmlBase64 = await consultarDCTFWeb(empresaId, clienteId, categoria, anoPA, mesPA);

                    // 6. Armazena o resultado da consulta DCTF Web no banco
                    await db.execute(
                        `INSERT INTO dctfweb (empresa_id, cliente_id, data_criacao, xml_base64, status) 
                        VALUES (?, ?, NOW(), ?, ?)`,
                        [empresaId, clienteId, xmlBase64, "Em Andamento"]
                    );

                    console.log(`✅ Consulta DCTF Web realizada para o cliente ${clienteId}`);

                } catch (clienteErro) {
                    console.error(`❌ Erro ao processar cliente ${clienteId}:`, clienteErro.message);
                }
            }
        }

        console.log("✅ Processamento mensal concluído.");

    } catch (error) {
        console.error("❌ Erro geral no cronjob de Situação Fiscal:", error.message);
    }
});
