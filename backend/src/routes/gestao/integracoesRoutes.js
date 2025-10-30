const express = require('express');
const { solicitarProtocolo } = require('../../services/gestao/apoioService');
const { emitirRelatorio } = require('../../services/gestao/emitirService');
const { consultarServico } = require("../../services/gestao/consultarService"); 
const { extrairDadosRelatorio } = require("../../services/gestao/extracaoService");
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const db = require('../../config/database');
const autenticarToken = require("../../middlewares/auth");
const { consultarDocumentosAlterdata, obterConteudoDocumento } = require('../../services/gestao/epluginService');
const { obterTokenEplugin } = require('../../services/gestao/epluginService');
const pdfParse = require('pdf-parse');

const router = express.Router();

// Função para obter data/hora do servidor ajustada para horário de Brasília
function getDataHoraServidor() {
  const agora = new Date();
  agora.setHours(agora.getHours() - 3); // Ajusta para horário de Brasília (UTC-3)
  const pad = n => String(n).padStart(2, "0");
  return {
    dataHora: agora.getFullYear() + "-" +
      pad(agora.getMonth() + 1) + "-" +
      pad(agora.getDate()) + " " +
      pad(agora.getHours()) + ":" +
      pad(agora.getMinutes()) + ":" +
      pad(agora.getSeconds()),
    data: agora.getFullYear() + "-" +
      pad(agora.getMonth() + 1) + "-" +
      pad(agora.getDate()),
    hora: pad(agora.getHours()) + ":" +
      pad(agora.getMinutes()) + ":" +
      pad(agora.getSeconds())
  };
}

// Função para extrair texto do PDF base64
async function extrairTextoDoPDF(base64) {
    try {
        const buffer = Buffer.from(base64, 'base64');
        const data = await pdfParse(buffer);
        const primeiraPagina = data.text.split("\f")[0];
        return primeiraPagina;
    } catch (error) {
        console.error("❌ Erro ao extrair texto do PDF:", error);
        return null;
    }
}

// Função para quebrar texto de forma inteligente (copiada do pdfLayoutRoutes.js)
function quebrarTextoInteligente(texto) {
    // Primeiro, tenta quebrar por quebras de linha
    let linhas = texto
        .split(/\n/)
        .map(linha => linha.trim())
        .filter(linha => linha.length > 0);
    
    if (linhas.length > 1) {
        return linhas;
    }
    
    // Fallback: quebra por espaços simples
    linhas = texto
        .split(/\s+/)
        .map(linha => linha.trim())
        .filter(linha => linha.length > 0);
    
    if (linhas.length > 1) {
        return linhas;
    }
    
    // Último fallback: chunks de 80 caracteres
    const textoLimpo = texto.replace(/\s+/g, " ");
    const chunks = [];
    for (let i = 0; i < textoLimpo.length; i += 80) {
        chunks.push(textoLimpo.slice(i, i + 80).trim());
    }
    return chunks.filter(chunk => chunk.length > 0);
}

// Função para fazer match com PDF Layout
function calcularScoreMatch(dadosMatch) {
    let score = 0;
    
    // Pontos por cada campo que bateu
    if (dadosMatch.obrigacao) score += 10;
    if (dadosMatch.competencia) score += 10;
    if (dadosMatch.cnpj) score += 5;
    if (dadosMatch.clienteNome) score += 5;
    
    // Bônus por competência exata
    if (dadosMatch.competenciaMes && dadosMatch.competenciaAno) {
        if (dadosMatch.mesReferencia && dadosMatch.anoReferencia) {
            if (dadosMatch.competenciaMes === dadosMatch.mesReferencia && 
                dadosMatch.competenciaAno === dadosMatch.anoReferencia) {
                score += 20; // Bônus por competência perfeita
            }
        }
    }
    
    return score;
}

async function fazerMatchComPDFLayout(textoCompleto, linhas, pdfLayoutId, empresaId, obrigacaoClienteId) {
    try {
        // Buscar campos do layout
        const [campos] = await db.query(
            `SELECT * FROM pdf_layout_campos WHERE layout_id = ?`,
            [pdfLayoutId]
        );
        
        if (campos.length === 0) {
            return { sucesso: false, motivo: "Layout sem campos configurados" };
        }
        
        // Funções utilitárias para validação
        function validaLinhaPorRegex(linhas, regex) {
            try {
                const re = new RegExp(regex, "i");
                if (re.test(textoCompleto)) {
                    return true;
                }
                return linhas.some(linha => re.test(linha));
            } catch {
                return false;
            }
        }

        function validaLinhaPorValor(linhas, valor) {
            if (textoCompleto.includes(valor)) {
                return true;
            }
            return linhas.some(linha => linha.includes(valor));
        }
        
        // Extrair dados usando a lógica do PDF Layout
        let obrigacaoDetectada = "";
        let cnpjExtraido = "";
        let competenciaExtraida = "";
        
        // Processar cada campo do layout
        for (const campo of campos) {
            let autoMatch = null;
            let found = null;

            if (campo.tipo_campo === "competencia") {
                // 🔍 CRÍTICO: Usar lógica da rota original (busca por posição + fallbacks)
                console.log(`   🔍 BUSCANDO COMPETÊNCIA (posição linha: ${campo.posicao_linha})`);
                
                // 1. PRIORIDADE: Buscar na linha específica se definida
                if (campo.posicao_linha > 0 && linhas[campo.posicao_linha - 1]) {
                    const linha = linhas[campo.posicao_linha - 1];
                    console.log(`   🎯 Procurando na linha específica ${campo.posicao_linha}: "${linha}"`);
                    const competencia = extrairCompetenciaDaLinha(linha, campo.valor_esperado);
                    if (competencia) {
                        autoMatch = competencia;
                        console.log(`   ✅ COMPETÊNCIA ENCONTRADA na linha específica: "${competencia}"`);
                    }
                }
                
                // 2. FALLBACK: Buscar em linhas próximas (±2 linhas da posição específica)
                if (!autoMatch && campo.posicao_linha > 0) {
                    const linhaInicial = Math.max(0, campo.posicao_linha - 3);
                    const linhaFinal = Math.min(linhas.length, campo.posicao_linha + 2);
                    
                    console.log(`   🔍 Procurando em linhas próximas (${linhaInicial + 1} a ${linhaFinal})`);
                    
                    for (let i = linhaInicial; i < linhaFinal; i++) {
                        if (i === campo.posicao_linha - 1) continue; // Já verificou esta linha
                        const linha = linhas[i];
                        const competencia = extrairCompetenciaDaLinha(linha, campo.valor_esperado);
                        if (competencia) {
                            autoMatch = competencia;
                            console.log(`   ✅ COMPETÊNCIA ENCONTRADA na linha próxima ${i + 1}: "${competencia}"`);
                            break;
                        }
                    }
                }
                
                // 3. ÚLTIMO RECURSO: Buscar em todas as linhas (apenas se não tem posição específica)
                if (!autoMatch && (!campo.posicao_linha || campo.posicao_linha <= 0)) {
                    console.log(`   ⚠️ Sem posição específica, procurando em todas as linhas`);
                    for (let i = 0; i < linhas.length; i++) {
                        const linha = linhas[i];
                        const competencia = extrairCompetenciaDaLinha(linha, campo.valor_esperado);
                        if (competencia) {
                            autoMatch = competencia;
                            console.log(`   ✅ COMPETÊNCIA ENCONTRADA na linha ${i + 1}: "${competencia}"`);
                            break;
                        }
                    }
                }

                if (autoMatch) {
                    competenciaExtraida = autoMatch;
                } else {
                    console.log(`   ❌ COMPETÊNCIA NÃO ENCONTRADA`);
                }
            }

            if (campo.tipo_campo === "inscricao") {
                const match = textoCompleto.match(/\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/);
                autoMatch = match ? match[0] : null;
                
                if (autoMatch) {
                    cnpjExtraido = autoMatch;
                }
            }

            if (campo.tipo_campo === "obrigacao") {
                if (campo.regex_validacao) {
                    try {
                        const regex = new RegExp(campo.regex_validacao, "i");
                        found = linhas.find(linha => regex.test(linha));
                        if (found) autoMatch = found;
                    } catch (e) {}
                }
                if (!found && campo.valor_esperado) {
                    if (textoCompleto.includes(campo.valor_esperado)) {
                        autoMatch = campo.valor_esperado;
                    } else {
                        found = linhas.find(linha => linha.includes(campo.valor_esperado));
                        if (found) autoMatch = found;
                    }
                }
                if (!found && !autoMatch) {
                    const txtMaiusculo = textoCompleto.toUpperCase();
                    if (txtMaiusculo.includes("BALANCETE")) autoMatch = "BALANCETE";
                    else if (txtMaiusculo.includes("CAGED")) autoMatch = "CAGED";
                    else if (txtMaiusculo.includes("DCTF")) autoMatch = "DCTF";
                }

                if (autoMatch) {
                    obrigacaoDetectada = autoMatch;
                }
            }
        }
        
        // Verificar se todos os dados necessários foram extraídos
        if (!obrigacaoDetectada || !cnpjExtraido || !competenciaExtraida) {
            return { 
                sucesso: false, 
                motivo: "Dados insuficientes extraídos do PDF",
                dados: { obrigacao: obrigacaoDetectada, cnpj: cnpjExtraido, competencia: competenciaExtraida }
            };
        }
        
        // 🔍 VALIDAR COMPETÊNCIA COM OBRIGAÇÕES_CLIENTES
        
        try {
            // Buscar dados da obrigação do cliente
            const [obrigacaoCliente] = await db.query(`
                SELECT mes_referencia, ano_referencia, c.nome as cliente_nome
                FROM obrigacoes_clientes oc
                JOIN clientes c ON oc.clienteId = c.id
                WHERE oc.id = ?
            `, [obrigacaoClienteId]);
            
            if (obrigacaoCliente.length === 0) {
                return {
                    sucesso: false,
                    motivo: "Obrigação do cliente não encontrada",
                    dados: { obrigacao: obrigacaoDetectada, cnpj: cnpjExtraido, competencia: competenciaExtraida }
                };
            }
            
            const { mes_referencia, ano_referencia, cliente_nome } = obrigacaoCliente[0];
            
            // Converter competência extraída para formato comparável
            let competenciaExtraidaMes = null;
            let competenciaExtraidaAno = null;
            
            // Tentar diferentes formatos de competência
            const formatosCompetencia = [
                // MM/YYYY
                /^(\d{1,2})\/(\d{4})$/,
                // Mês/YYYY (texto)
                /^(janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\/(\d{4})$/i,
                // Mês abreviado/YYYY
                /^(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\/(\d{4})$/i
            ];
            
            let competenciaValida = false;
            
            for (const formato of formatosCompetencia) {
                const match = competenciaExtraida.match(formato);
                if (match) {
                    if (formato.source.includes('janeiro|fevereiro')) {
                        // Formato de texto (janeiro/2025)
                        const mesesTexto = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
                        const mesTexto = match[1].toLowerCase();
                        competenciaExtraidaMes = mesesTexto.indexOf(mesTexto) + 1;
                        competenciaExtraidaAno = parseInt(match[2]);
                    } else if (formato.source.includes('jan|fev')) {
                        // Formato abreviado (jan/2025)
                        const mesesAbrev = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
                        const mesAbrev = match[1].toLowerCase();
                        competenciaExtraidaMes = mesesAbrev.indexOf(mesAbrev) + 1;
                        competenciaExtraidaAno = parseInt(match[2]);
                    } else {
                        // Formato numérico (07/2025)
                        competenciaExtraidaMes = parseInt(match[1]);
                        competenciaExtraidaAno = parseInt(match[2]);
                    }
                    
                    break;
                }
            }
            
            if (!competenciaExtraidaMes || !competenciaExtraidaAno) {
                return {
                    sucesso: false,
                    motivo: `Competência não reconhecida: ${competenciaExtraida}`,
                    dados: { obrigacao: obrigacaoDetectada, cnpj: cnpjExtraido, competencia: competenciaExtraida }
                };
            }
            
            // Validar se a competência extraída corresponde à obrigação do cliente
            console.log(`   🔍 VALIDAÇÃO COMPETÊNCIA:`);
            console.log(`      Extraída: "${competenciaExtraida}" (${competenciaExtraidaMes}/${competenciaExtraidaAno})`);
            console.log(`      Esperada: ${mes_referencia}/${ano_referencia}`);
            
            if (competenciaExtraidaMes === mes_referencia && competenciaExtraidaAno === ano_referencia) {
                competenciaValida = true;
                console.log(`   ✅ COMPETÊNCIA VÁLIDA!`);
            } else {
                competenciaValida = false;
                console.log(`   ❌ COMPETÊNCIA INVÁLIDA!`);
            }
            
            return {
                sucesso: competenciaValida,
                motivo: competenciaValida ? "Match válido" : `Competência não corresponde (${competenciaExtraidaMes}/${competenciaExtraidaAno} vs ${mes_referencia}/${ano_referencia})`,
                dados: {
                    obrigacao: obrigacaoDetectada,
                    cnpj: cnpjExtraido,
                    competencia: competenciaExtraida,
                    competenciaMes: competenciaExtraidaMes,
                    competenciaAno: competenciaExtraidaAno,
                    mesReferencia: mes_referencia,
                    anoReferencia: ano_referencia,
                    clienteNome: cliente_nome
                }
            };
            
        } catch (errorValidacao) {
            return {
                sucesso: false,
                motivo: `Erro ao validar competência: ${errorValidacao.message}`,
                dados: { obrigacao: obrigacaoDetectada, cnpj: cnpjExtraido, competencia: competenciaExtraida }
            };
        }
        
    } catch (error) {
        console.error("❌ Erro ao fazer match com PDF Layout:", error);
        return { sucesso: false, motivo: error.message };
    }
}

// Função para extrair competência de uma linha específica (copiada da rota original)
function extrairCompetenciaDaLinha(linha, valorEsperado) {
    console.log(`   🔍 Analisando linha para competência: "${linha}"`);
    
    // Padrões de competência (múltiplos formatos)
    const padroesCompetencia = [
        // Mês/Ano (Janeiro/2025, jan/2025, 01/2025)
        /(janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\/\d{4}/gi,
        /(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\/\d{4}/gi,
        /\d{2}\/\d{4}/g, // MM/YYYY
        // Mês-Ano
        /(janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)-\d{4}/gi,
        /(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)-\d{4}/gi,
        // Mês de Ano
        /(janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\s+de\s+\d{4}/gi,
        // Apenas ano (quando não há mês específico)
        /\b\d{4}\b/g,
    ];
    
    for (const padrao of padroesCompetencia) {
        const matches = linha.match(padrao);
        if (matches && matches.length > 0) {
            const competencia = matches[0];
            console.log(`   ✅ Competência encontrada: ${competencia}`);
            
            // Se encontrou apenas o ano, tentar extrair mês do contexto
            if (/^\d{4}$/.test(competencia)) {
                // Procurar por mês na mesma linha
                const mesMatch = linha.match(/(janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro|jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)/i);
                if (mesMatch) {
                    const mes = converterMesParaNumero(mesMatch[0]);
                    return `${mes}/${competencia}`;
                }
            }
            
            return competencia;
        }
    }
    
    console.log(`   ❌ Nenhuma competência encontrada na linha`);
    return null;
}

// Função para converter mês para número (copiada da rota original)
function converterMesParaNumero(mes) {
    const meses = {
        'janeiro': '01', 'jan': '01',
        'fevereiro': '02', 'fev': '02',
        'março': '03', 'mar': '03',
        'abril': '04', 'abr': '04',
        'maio': '05', 'mai': '05',
        'junho': '06', 'jun': '06',
        'julho': '07', 'jul': '07',
        'agosto': '08', 'ago': '08',
        'setembro': '09', 'set': '09',
        'outubro': '10', 'out': '10',
        'novembro': '11', 'nov': '11',
        'dezembro': '12', 'dez': '12'
    };
    
    const mesLower = mes.toLowerCase();
    return meses[mesLower] || mes;
}

/**
 * 📌 1️⃣ Solicitação de Protocolo (Apoiar)
 */
router.post('/apoiar', async (req, res) => {
    try {
        const { contratanteNumero, autorPedidoNumero, contribuinteNumero, idSistema, idServico } = req.body;

        if (!contratanteNumero || !autorPedidoNumero || !contribuinteNumero || !idSistema || !idServico) {
            return res.status(400).json({ error: "Todos os campos são obrigatórios." });
        }

        const response = await solicitarProtocolo(contratanteNumero, autorPedidoNumero, contribuinteNumero, idSistema, idServico);
        res.json(response);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * 📌 2️⃣ Emissão do Relatório (Emitir)
 */
router.post('/emitir', async (req, res) => {
    try {
        const { protocoloRelatorio, contratanteNumero, autorPedidoNumero, contribuinteNumero } = req.body;

        if (!protocoloRelatorio || !contratanteNumero || !autorPedidoNumero || !contribuinteNumero) {
            return res.status(400).json({ error: "Todos os campos são obrigatórios." });
        }

        const response = await emitirRelatorio(protocoloRelatorio, contratanteNumero, autorPedidoNumero, contribuinteNumero);
        res.json(response);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * 📌 3️⃣ Download do Relatório (PDF)
 */
router.get('/relatorio/:protocolo', (req, res) => {
    try {
        const { protocolo } = req.params;

        // Gerar o hash para buscar o arquivo
        const fileHash = crypto.createHash('sha256').update(protocolo).digest('hex');
        const filePath = path.join(__dirname, `../../storage/relatorios/relatorio_${fileHash}.pdf`);

        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: "Relatório não encontrado." });
        }

        res.download(filePath, `relatorio_${fileHash}.pdf`);
    } catch (error) {
        res.status(500).json({ error: "Erro ao buscar relatório." });
    }
});

/**
 * 📌 4️⃣ Extração de Texto do Relatório (PDF)
 */
router.get('/relatorio/texto/:protocolo', async (req, res) => {
    try {
        const { protocolo } = req.params;
        const response = await extrairDadosRelatorio(protocolo);

        res.json(response);
    } catch (error) {
        res.status(500).json({ error: "Erro ao extrair dados do relatório." });
    }
});

/**
 * 📌 Rota única para todas as consultas via Integra Contador
 */
router.post("/consultar", async (req, res) => {
    try {
        let { contratanteNumero, autorPedidoNumero, contribuinteNumero, idSistema, idServico, dados } = req.body;

        if (!contratanteNumero || !autorPedidoNumero || !contribuinteNumero || !idSistema || !idServico) {
            return res.status(400).json({ error: "Todos os campos são obrigatórios." });
        }

        // Se o serviço for PEDIDOSPARC163, permitir "dados" ser uma string vazia
        if (!dados && idServico !== "PEDIDOSPARC163") {
            return res.status(400).json({ error: "O campo 'dados' é obrigatório para este serviço." });
        }

        const response = await consultarServico(contratanteNumero, autorPedidoNumero, contribuinteNumero, idSistema, idServico, dados || "");
        res.json(response);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


//INTEGRAÇÃO ECONTADOR

// Middleware específico para rota de baixa automática (CORS + Timeout + Performance)
const middlewareBaixaAutomatica = (req, res, next) => {
    // Headers CORS específicos para esta rota (funciona em localhost e produção)
    const origin = req.headers.origin;
    
    if (origin === 'http://localhost:3000' || origin?.includes('cftitan.com.br')) {
        res.header('Access-Control-Allow-Origin', origin);
    }
    
    res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Origin, Accept');
    res.header('Access-Control-Allow-Credentials', 'true');
    
    // Timeout específico para esta rota (15 minutos)
    req.setTimeout(900000); // 15 minutos
    res.setTimeout(900000); // 15 minutos
    
    // Log para debug
    console.log(`🕐 [${new Date().toISOString()}] Iniciando rota baixar-atividades e-contador`);
    console.log(`🌐 Origin: ${req.headers.origin || 'N/A'}`);
    console.log(`🔑 Authorization: ${req.headers.authorization ? 'Presente' : 'Ausente'}`);
    
    // Medidor de performance
    req.startTime = Date.now();
    
    next();
};

// Rota OPTIONS para preflight requests CORS
router.options('/baixar-atividades', (req, res) => {
    const origin = req.headers.origin;
    
    if (origin === 'http://localhost:3000' || origin?.includes('cftitan.com.br')) {
        res.header('Access-Control-Allow-Origin', origin);
    }
    
    res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Origin, Accept');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Max-Age', '86400'); // 24 horas
    res.status(200).end();
});

// Função otimizada para processar atividades em paralelo (MANTÉM COMPORTAMENTO IDÊNTICO)
async function processarAtividadesEmParalelo(atividadesCliente, atividadeBase, empresaId, tokenEplugin, req) {
    const promises = atividadesCliente.map(async (atividadeCliente) => {
        try {
            const {
                id: atividadeId,
                obrigacaoClienteId,
                clienteId,
                clienteNome,
                clienteCnpjCpf,
                obrigacaoClienteStatus,
                obrigacaoClienteBaixadaAutomaticamente
            } = atividadeCliente;

            let documentosEncontrados = [];
            let metodoBusca = 'N/A';
            
            // Buscar documentos em paralelo
            const resCnpj = await consultarDocumentosAlterdata(clienteCnpjCpf, {
                'page[limit]': 50,
                sort: '-criacao'
            }, tokenEplugin);
            
            const todosDocumentos = resCnpj.data || [];
            
            // Filtrar localmente por título (MANTÉM LÓGICA IDÊNTICA)
            documentosEncontrados = todosDocumentos.filter(doc => {
                const tituloDoc = doc.attributes?.titulo || doc.attributes?.nome || '';
                const matchExato = tituloDoc.toLowerCase() === atividadeBase.tituloDocumentoEsperado.toLowerCase();
                const matchParcial = tituloDoc.toLowerCase().includes(atividadeBase.tituloDocumentoEsperado.toLowerCase());
                
                return matchExato || matchParcial;
            });
            
            metodoBusca = 'CNPJ + Filtro Local';
            
            if (documentosEncontrados.length === 0) {
                return {
                    atividadeId,
                    obrigacaoClienteId,
                    clienteNome,
                    tituloDocumentoEsperado: atividadeBase.tituloDocumentoEsperado,
                    status: 'FALHA',
                    mensagem: `Nenhum documento correspondente encontrado no Alterdata.`,
                    metodoBusca,
                    totalDocumentos: 0,
                    documentosEncontrados: []
                };
            }
            
            // Processar cada documento encontrado (MANTÉM LÓGICA IDÊNTICA)
            let melhorDocumento = null;
            let melhorScore = 0;
            
            for (let index = 0; index < documentosEncontrados.length; index++) {
                const doc = documentosEncontrados[index];
                try {
                    const conteudoResult = await obterConteudoDocumento(doc.id, empresaId);
                    if (conteudoResult.success) {
                        // Verificar se temos conteúdo base64 válido
                        if (typeof conteudoResult.data === 'string' && conteudoResult.data.length > 0) {
                            // Adicionar o conteúdo ao documento
                            doc.conteudo = conteudoResult.data;
                            doc.conteudoEndpoint = conteudoResult.endpoint;
                            doc.conteudoContentType = conteudoResult.contentType;
                        } else {
                            doc.conteudo = null;
                        }
                        
                        // 🔍 FAZER MATCH COM PDF LAYOUT (se configurado) - MANTÉM LÓGICA IDÊNTICA
                        if (atividadeBase.pdfLayoutId && doc.conteudo) {
                            // Extrair texto do PDF base64
                            const textoPDF = await extrairTextoDoPDF(doc.conteudo);
                            if (textoPDF) {
                                // Quebrar texto em linhas
                                const linhas = quebrarTextoInteligente(textoPDF);
                                const textoCompleto = linhas.join(" ");
                                
                                // Fazer match com PDF Layout
                                const resultadoMatch = await fazerMatchComPDFLayout(textoCompleto, linhas, atividadeBase.pdfLayoutId, empresaId, obrigacaoClienteId);
                                
                                if (resultadoMatch.sucesso) {
                                    // Adicionar dados do match ao documento
                                    doc.pdfLayoutMatch = resultadoMatch.dados;
                                    
                                    // Calcular score do match (quanto mais campos batem, melhor)
                                    const score = calcularScoreMatch(resultadoMatch.dados);
                                    
                                    // Verificar se é o melhor match até agora
                                    if (score > melhorScore) {
                                        melhorScore = score;
                                        melhorDocumento = doc;
                                    }
                                }
                            }
                        } else if (doc.conteudo) {
                            // Se não tem PDF Layout configurado, considerar válido se tem conteúdo
                            // Score básico para documentos sem validação
                            const score = 1;
                            if (score > melhorScore) {
                                melhorScore = score;
                                melhorDocumento = doc;
                            }
                        }
                    } else {
                        // Salvar erro na tabela (MANTÉM LÓGICA IDÊNTICA)
                        try {
                            await db.query(`
                                INSERT INTO arquivos_baixados_automaticamente 
                                (empresaId, clienteId, atividadeId, base64, nomeArquivo)
                                VALUES (?, ?, ?, ?, ?)
                            `, [
                                empresaId,
                                clienteId,
                                atividadeId,
                                '',
                                `ERRO_${atividadeBase.tituloDocumentoEsperado}_${doc.id}`
                            ]);
                        } catch (errorSalvar) {
                            console.log(`          ❌ Erro ao salvar: ${errorSalvar.message}`);
                        }
                    }
                } catch (errorConteudo) {
                    // Erro silencioso (MANTÉM COMPORTAMENTO IDÊNTICO)
                }
            }
            
            // Salvar apenas o MELHOR documento (MANTÉM LÓGICA IDÊNTICA)
            if (melhorDocumento) {
                try {
                    const nomeArquivo = melhorDocumento.pdfLayoutMatch 
                        ? `${atividadeBase.tituloDocumentoEsperado}_${melhorDocumento.pdfLayoutMatch.obrigacao}_${melhorDocumento.pdfLayoutMatch.competencia}_${melhorDocumento.id}.pdf`
                        : `${atividadeBase.tituloDocumentoEsperado}_${melhorDocumento.id}.pdf`;
                        
                    // 1. Salvar na tabela arquivos_baixados_automaticamente
                    await db.query(`
                        INSERT INTO arquivos_baixados_automaticamente 
                        (empresaId, clienteId, atividadeId, base64, nomeArquivo)
                        VALUES (?, ?, ?, ?, ?)
                    `, [
                        empresaId,
                        clienteId,
                        atividadeId,
                        melhorDocumento.conteudo,
                        nomeArquivo
                    ]);
                    
                    // 2. Salvar na tabela obrigacoes_atividades_clientes (anexo e nomeArquivo)
                    console.log(`          🔍 Atualizando obrigacoes_atividades_clientes ID: ${atividadeId}`);
                    console.log(`          📄 Nome do arquivo: ${nomeArquivo}`);
                    console.log(`          📏 Tamanho do conteúdo: ${melhorDocumento.conteudo ? melhorDocumento.conteudo.length : 0} caracteres`);
                    
                    // Usar a mesma lógica do PDF Layout: WHERE id = ?
                    const { dataHora } = getDataHoraServidor();
                    const updateResult = await db.query(`
                        UPDATE obrigacoes_atividades_clientes 
                        SET anexo = ?, nomeArquivo = ?, concluida = 1, dataConclusao = ?
                        WHERE id = ?
                    `, [
                        melhorDocumento.conteudo,
                        nomeArquivo,
                        dataHora,
                        atividadeId
                    ]);
                    
                    console.log(`          💾 Resultado da atualização: ${updateResult[0].affectedRows} linha(s) afetada(s)`);
                    
                    if (updateResult[0].affectedRows > 0) {
                        console.log(`          ✅ obrigacoes_atividades_clientes atualizada com sucesso!`);
                        
                        // Adicionar comentário automático resumido (MANTÉM LÓGICA IDÊNTICA)
                        const detalhesMatch = melhorDocumento.pdfLayoutMatch ? {
                            obrigacao: melhorDocumento.pdfLayoutMatch.obrigacao,
                            competencia: melhorDocumento.pdfLayoutMatch.competencia,
                            cnpj: melhorDocumento.pdfLayoutMatch.cnpj,
                            score: melhorScore
                        } : null;

                        const comentarioResumido = `Baixa automática completa com integração eContador realizada com sucesso.\n\n` +
                            `Documento: "${melhorDocumento.attributes?.titulo || melhorDocumento.attributes?.nome}"\n` +
                            `ID: ${melhorDocumento.id}\n` +
                            `Score: ${melhorScore}/50\n` +
                            (detalhesMatch ? 
                                `Dados extraídos: ${detalhesMatch.obrigacao} - ${detalhesMatch.competencia} - ${detalhesMatch.cnpj}\n` :
                                `Validação: Documento aceito sem validação específica\n`
                            ) +
                            `Processado em: ${new Date().toLocaleString('pt-BR')}`;

                        // Inserir comentário na tabela comentarios_obrigacao
                        await db.query(`
                            INSERT INTO comentarios_obrigacao 
                            (obrigacaoid, usuarioid, comentario, criadoEm, tipo) 
                            VALUES (?, ?, ?, NOW(), 'usuario')
                        `, [obrigacaoClienteId, req.usuario?.id || 1, comentarioResumido]);

                        console.log(`          Comentário automático adicionado!`);
                    } else {
                        console.log(`          ❌ NENHUMA LINHA FOI ATUALIZADA!`);
                        
                        console.log(`          🔍 Verificando se a atividade ID ${atividadeId} existe:`);
                        
                        const [checkActivity] = await db.query(`
                            SELECT id, texto, tipo, concluida FROM obrigacoes_atividades_clientes 
                            WHERE id = ?
                        `, [atividadeId]);
                        
                        if (checkActivity.length > 0) {
                            console.log(`          ℹ️ Atividade encontrada: ID ${checkActivity[0].id}, Tipo: "${checkActivity[0].tipo}", Texto: "${checkActivity[0].texto}", Concluída: ${checkActivity[0].concluida}`);
                        } else {
                            console.log(`          ❌ Atividade com obrigacaoClientId ${obrigacaoClienteId} e texto "${atividadeBase.atividadeTexto}" não encontrada na tabela obrigacoes_atividades_clientes`);
                        }
                    }
                    
                } catch (errorSalvar) {
                    // Erro silencioso (MANTÉM COMPORTAMENTO IDÊNTICO)
                }
            }
            
            // Verificar se encontrou o melhor documento (MANTÉM LÓGICA IDÊNTICA)
            if (melhorDocumento) {
                console.log(`    ✅ Atividade concluída (melhor documento selecionado - score: ${melhorScore})`);
                
                return {
                    atividadeId,
                    obrigacaoClienteId,
                    clienteNome,
                    tituloDocumentoEsperado: atividadeBase.tituloDocumentoEsperado,
                    status: 'SUCESSO',
                    mensagem: `Melhor documento encontrado e atividade baixada automaticamente.`,
                    metodoBusca,
                    totalDocumentos: 1,
                    documentosEncontrados: [{
                        id: melhorDocumento.id,
                        titulo: melhorDocumento.attributes?.titulo || melhorDocumento.attributes?.nome,
                        categoria: melhorDocumento.attributes?.categoria?.nome,
                        status: melhorDocumento.attributes?.status?.nome,
                        criacao: melhorDocumento.attributes?.criacao,
                        vencimento: melhorDocumento.attributes?.vencimento,
                        empresa: melhorDocumento.attributes?.empresa?.nome,
                        departamento: melhorDocumento.attributes?.departamento?.nome,
                        pago: melhorDocumento.attributes?.pago,
                        url: melhorDocumento.attributes?.url,
                        tamanho: melhorDocumento.attributes?.tamanho,
                        tipo: melhorDocumento.attributes?.tipo,
                        extensao: melhorDocumento.attributes?.extensao,
                        hash: melhorDocumento.attributes?.hash,
                        estruturaCompleta: melhorDocumento
                    }]
                };
            } else {
                return {
                    atividadeId,
                    obrigacaoClienteId,
                    clienteNome,
                    tituloDocumentoEsperado: atividadeBase.tituloDocumentoEsperado,
                    status: 'FALHA',
                    mensagem: `Nenhum documento válido encontrado (competência não confere).`,
                    metodoBusca,
                    totalDocumentos: documentosEncontrados.length,
                    documentosEncontrados: []
                };
            }
            
        } catch (error) {
            console.error(`❌ Erro ao processar atividade ${atividadeCliente.id}:`, error.message);
            return {
                atividadeId: atividadeCliente.id,
                obrigacaoClienteId: atividadeCliente.obrigacaoClienteId,
                clienteNome: atividadeCliente.cliente_nome,
                tituloDocumentoEsperado: atividadeBase.tituloDocumentoEsperado,
                status: 'FALHA',
                mensagem: `Erro interno: ${error.message}`,
                metodoBusca: 'N/A',
                totalDocumentos: 0,
                documentosEncontrados: []
            };
        }
    });
    
    // Executar todas as promessas em paralelo (OTIMIZAÇÃO DE PERFORMANCE)
    return await Promise.all(promises);
}

// Endpoint para baixa automática de atividades de integração eContador
router.post('/baixar-atividades', autenticarToken, middlewareBaixaAutomatica, async (req, res) => {
    try {
        const empresaId = req.usuario?.empresaId;
        
        if (!empresaId) {
            return res.status(400).json({ error: "Empresa ID é obrigatório." });
        }

        // Verificação básica do ID da empresa
        if (isNaN(empresaId)) {
            console.warn("⚠️ ID da empresa inválido:", empresaId);
            return res.status(400).json({ error: "O ID da empresa deve ser um número válido." });
        }

        const resultadosProcessamento = [];
        let tokenEplugin = null;
        
        tokenEplugin = await obterTokenEplugin(empresaId);
        if (!tokenEplugin) {
            throw new Error("❌ Nenhum token válido do Eplugin encontrado para a empresa principal.");
        }
        // Buscar atividades base do tipo "Integração: eContador"
        const [atividadesBaseEcontador] = await db.query(`
            SELECT
                ao.id AS atividadeBaseId,
                ao.texto AS atividadeTexto,
                ao.titulo_documento AS tituloDocumentoEsperado,
                ao.pdf_layout_id AS pdfLayoutId,
                o.id AS obrigacaoBaseId,
                o.nome AS obrigacaoNome
            FROM atividades_obrigacao ao
            JOIN obrigacoes o ON ao.obrigacaoId = o.id
            WHERE ao.tipo = 'Integração: eContador'
            AND o.empresaId = ?
        `, [empresaId]);
        
        if (atividadesBaseEcontador.length === 0) {
            return res.json({
                success: true,
                message: "Nenhuma atividade base 'Integração: eContador' encontrada.",
                detalhes: []
            });
        }
        
        console.log(`🔍 Encontradas ${atividadesBaseEcontador.length} atividades base de integração eContador.`);
        
        // OTIMIZAÇÃO: Buscar TODAS as atividades do cliente de uma vez (evita N+1 queries)
        const obrigacaoIds = atividadesBaseEcontador.map(ab => ab.obrigacaoBaseId);
        const [todasAtividadesCliente] = await db.query(`
            SELECT 
                oac.id, oac.concluida, oac.obrigacaoClienteId, oac.texto, oac.descricao, oac.tipo, 
                o.nome as obrigacao_nome, c.nome as cliente_nome, c.id as clienteId, c.cnpjCpf as clienteCnpjCpf,
                oc.status as obrigacaoClienteStatus, oc.baixadaAutomaticamente as obrigacaoClienteBaixadaAutomatica,
                o.id as obrigacaoId
            FROM obrigacoes_atividades_clientes oac
            JOIN obrigacoes_clientes oc ON oac.obrigacaoClienteId = oc.id
            JOIN obrigacoes o ON oc.obrigacaoId = o.id
            JOIN clientes c ON oc.clienteId = c.id
            WHERE oc.obrigacaoId IN (${obrigacaoIds.map(() => '?').join(',')})
            AND oac.tipo = 'Integração: eContador'
            AND oac.concluida = 0
            AND oc.status != 'concluida'
            AND oc.baixadaAutomaticamente = 0
        `, obrigacaoIds);
        
        console.log(`🔍 Encontradas ${todasAtividadesCliente.length} atividades do cliente para processamento.`);
        
        // Agrupar atividades por atividade base para processamento em paralelo
        for (const atividadeBase of atividadesBaseEcontador) {
            const atividadesCliente = todasAtividadesCliente.filter(ac => ac.obrigacaoId === atividadeBase.obrigacaoBaseId);
            
            if (atividadesCliente.length === 0) {
                console.log(`    ⚠️ Nenhuma atividade do cliente encontrada para atividade base: "${atividadeBase.atividadeTexto}"`);
                continue;
            }
            
            console.log(`    🔍 Processando ${atividadesCliente.length} atividades para: "${atividadeBase.atividadeTexto}"`);
            
            // Processar atividades em paralelo (OTIMIZAÇÃO DE PERFORMANCE)
            const resultados = await processarAtividadesEmParalelo(atividadesCliente, atividadeBase, empresaId, tokenEplugin, req);
            resultadosProcessamento.push(...resultados);
        }
        
        // Calcular tempo de execução
        const tempoExecucao = Date.now() - req.startTime;
        
        // Estatísticas de processamento
        const sucessos = resultadosProcessamento.filter(r => r.status === 'SUCESSO').length;
        const falhas = resultadosProcessamento.filter(r => r.status === 'FALHA').length;
        
        console.log(`⚡ Processamento concluído em ${tempoExecucao}ms`);
        console.log(`✅ Sucessos: ${sucessos}, ❌ Falhas: ${falhas}`);
        
        res.json({
            success: true,
            message: `Processamento concluído em ${tempoExecucao}ms`,
            tempoExecucao,
            estatisticas: {
                total: resultadosProcessamento.length,
                sucessos,
                falhas
            },
            detalhes: resultadosProcessamento
        });
    } catch (error) {
        console.error("❌ Erro geral no processo de baixa automática eContador:", error);
        res.status(500).json({ 
            success: false, 
            message: "Erro interno no processo de baixa automática",
            error: error.message
        });
    }
});

// Rota para buscar matches específicos para uma atividade
router.post('/buscar-matches-atividade', autenticarToken, async (req, res) => {
    try {
        const { atividadeId, obrigacaoClienteId } = req.body;
        const empresaId = req.usuario?.empresaId;
        
        if (!empresaId || !atividadeId || !obrigacaoClienteId) {
            return res.status(400).json({ 
                success: false, 
                message: "EmpresaId, atividadeId e obrigacaoClienteId são obrigatórios." 
            });
        }

        // Buscar informações da atividade - CORREÇÃO: usar obrigacaoId diretamente
        const [atividade] = await db.query(`
            SELECT ao.id AS atividadeId, ao.texto AS atividadeTexto, ao.titulo_documento AS tituloDocumentoEsperado,
                   ao.pdf_layout_id AS pdfLayoutId, o.id AS obrigacaoBaseId, o.nome AS obrigacaoNome,
                   oc.id AS obrigacaoClienteId, c.id AS clienteId, c.nome AS clienteNome, c.cnpjCpf AS clienteCnpjCpf
            FROM obrigacoes_atividades_clientes oac
            JOIN obrigacoes_clientes oc ON oac.obrigacaoClienteId = oc.id
            JOIN obrigacoes o ON oc.obrigacaoId = o.id
            JOIN clientes c ON oc.clienteId = c.id
            JOIN atividades_obrigacao ao ON o.id = ao.obrigacaoId AND oac.tipo = ao.tipo
            WHERE oac.id = ? AND oac.obrigacaoClienteId = ? AND oac.tipo = 'Integração: eContador'
        `, [atividadeId, obrigacaoClienteId]);

        if (atividade.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: "Atividade não encontrada ou não é do tipo 'Integração: eContador'" 
            });
        }

        const atividadeInfo = atividade[0];
        
        // Obter token do Eplugin
        const tokenEplugin = await obterTokenEplugin(empresaId);
        if (!tokenEplugin) {
            return res.status(400).json({ 
                success: false, 
                message: "Token do Eplugin não encontrado" 
            });
        }

        // Buscar documentos no Alterdata
        let documentosEncontrados = [];
        try {
            const resCnpj = await consultarDocumentosAlterdata(atividadeInfo.clienteCnpjCpf, {
                'page[limit]': 50,
                sort: '-criacao'
            }, tokenEplugin);
            
            const todosDocumentos = resCnpj.data || [];
            
            // Filtrar localmente por título
            documentosEncontrados = todosDocumentos.filter(doc => {
                const tituloDoc = doc.attributes?.titulo || doc.attributes?.nome || '';
                const matchExato = tituloDoc.toLowerCase() === atividadeInfo.tituloDocumentoEsperado.toLowerCase();
                const matchParcial = tituloDoc.toLowerCase().includes(atividadeInfo.tituloDocumentoEsperado.toLowerCase());
                
                return matchExato || matchParcial;
            });
        } catch (error) {
            console.error("Erro ao buscar documentos:", error);
        }

        if (documentosEncontrados.length === 0) {
            return res.json({
                success: false,
                message: "Nenhum documento encontrado para esta atividade"
            });
        }

        // Processar documentos encontrados
        let melhorDocumento = null;
        let melhorScore = 0;
        
        for (const doc of documentosEncontrados) {
            try {
                const conteudoResult = await obterConteudoDocumento(doc.id, empresaId);
                if (conteudoResult.success && conteudoResult.data) {
                    doc.conteudo = conteudoResult.data;
                    
                    // Fazer match com PDF Layout se configurado
                    if (atividadeInfo.pdfLayoutId && doc.conteudo) {
                        const textoPDF = await extrairTextoDoPDF(doc.conteudo);
                        if (textoPDF) {
                            const linhas = quebrarTextoInteligente(textoPDF);
                            const textoCompleto = linhas.join(" ");
                            
                            const resultadoMatch = await fazerMatchComPDFLayout(textoCompleto, linhas, atividadeInfo.pdfLayoutId, empresaId, obrigacaoClienteId);
                            
                            if (resultadoMatch.sucesso) {
                                doc.pdfLayoutMatch = resultadoMatch.dados;
                                const score = calcularScoreMatch(resultadoMatch.dados);
                                
                                if (score > melhorScore) {
                                    melhorScore = score;
                                    melhorDocumento = doc;
                                }
                            }
                        }
                    } else if (doc.conteudo) {
                        // Score básico para documentos sem validação
                        const score = 1;
                        if (score > melhorScore) {
                            melhorScore = score;
                            melhorDocumento = doc;
                        }
                    }
                }
            } catch (error) {
                console.error("Erro ao processar documento:", error);
            }
        }

        if (melhorDocumento) {
            // Salvar o melhor documento
            const nomeArquivo = melhorDocumento.pdfLayoutMatch 
                ? `${atividadeInfo.tituloDocumentoEsperado}_${melhorDocumento.pdfLayoutMatch.obrigacao}_${melhorDocumento.pdfLayoutMatch.competencia}_${melhorDocumento.id}.pdf`
                : `${atividadeInfo.tituloDocumentoEsperado}_${melhorDocumento.id}.pdf`;

            // Salvar na tabela arquivos_baixados_automaticamente
            await db.query(`
                INSERT INTO arquivos_baixados_automaticamente 
                (empresaId, clienteId, atividadeId, base64, nomeArquivo)
                VALUES (?, ?, ?, ?, ?)
            `, [empresaId, atividadeInfo.clienteId, atividadeId, melhorDocumento.conteudo, nomeArquivo]);

            // Atualizar a atividade
            await db.query(`
                UPDATE obrigacoes_atividades_clientes 
                SET anexo = ?, nomeArquivo = ?, concluida = 1, dataConclusao = NOW()
                WHERE id = ?
            `, [melhorDocumento.conteudo, nomeArquivo, atividadeId]);

            return res.json({
                success: true,
                message: "Match encontrado e atividade concluída com sucesso",
                data: {
                    documentoId: melhorDocumento.id,
                    titulo: melhorDocumento.attributes?.titulo || melhorDocumento.attributes?.nome,
                    score: melhorScore
                }
            });
        } else {
            return res.json({
                success: false,
                message: "Nenhum documento válido encontrado"
            });
        }

    } catch (error) {
        console.error("Erro ao buscar matches para atividade:", error);
        res.status(500).json({ 
            success: false, 
            message: "Erro interno no processo de busca de matches",
            error: error.message
        });
    }
});

// Rota para busca automática por CNPJ do cliente
router.post('/buscar-automatico-por-cnpj', autenticarToken, async (req, res) => {
    try {
        const { clienteId, obrigacaoClienteId } = req.body;
        const empresaId = req.usuario?.empresaId;
        
        if (!empresaId || !clienteId || !obrigacaoClienteId) {
            return res.status(400).json({ 
                success: false, 
                message: "EmpresaId, clienteId e obrigacaoClienteId são obrigatórios." 
            });
        }

        // Buscar a atividade principal (Integração: eContador) para esta obrigação
        const [atividadeInfo] = await db.query(`
            SELECT oac.id AS atividadeId, oac.texto AS atividadeTexto, ao.titulo_documento AS tituloDocumentoEsperado,
                   ao.pdf_layout_id AS pdfLayoutId, o.id AS obrigacaoBaseId, o.nome AS obrigacaoNome,
                   oc.id AS obrigacaoClienteId, c.id AS clienteId, c.nome AS clienteNome, c.cnpjCpf AS clienteCnpjCpf,
                   oc.ano_referencia, oc.mes_referencia
            FROM obrigacoes_atividades_clientes oac
            JOIN obrigacoes_clientes oc ON oac.obrigacaoClienteId = oc.id
            JOIN obrigacoes o ON oc.obrigacaoId = o.id
            JOIN clientes c ON oc.clienteId = c.id
            JOIN atividades_obrigacao ao ON o.id = ao.obrigacaoId AND oac.tipo = ao.tipo
            WHERE oc.id = ? AND oac.tipo = 'Integração: eContador' AND c.empresaId = ?
        `, [obrigacaoClienteId, empresaId]);

        if (atividadeInfo.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: "Atividade 'Integração: eContador' não encontrada para esta obrigação" 
            });
        }

        const info = atividadeInfo[0];
        
        // Obter token do Eplugin
        const tokenEplugin = await obterTokenEplugin(empresaId);
        if (!tokenEplugin) {
            return res.status(400).json({ 
                success: false, 
                message: "Token do Eplugin não encontrado" 
            });
        }

                // Buscar documentos no Alterdata por CNPJ
        let documentosEncontrados = [];
        try {
            const competencia = `${info.mes_referencia}/${info.ano_referencia}`;
            console.log(`🔍 Buscando documentos para CNPJ: ${info.clienteCnpjCpf}`);
            console.log(`👤 Cliente: ${info.clienteNome}`);
            console.log(`📋 Obrigação: ${info.obrigacaoNome}`);
            console.log(`📄 Título esperado: "${info.tituloDocumentoEsperado}"`);
            console.log(`📅 Competência: ${competencia}`);
            
            const resCnpj = await consultarDocumentosAlterdata(info.clienteCnpjCpf, {
                'page[limit]': 100,
                sort: '-criacao'
            }, tokenEplugin);
            
            const todosDocumentos = resCnpj.data || [];
            console.log(`📄 Total de documentos encontrados no eContador: ${todosDocumentos.length}`);
            
            // Log de todos os documentos encontrados
            todosDocumentos.forEach((doc, index) => {
                const titulo = doc.attributes?.titulo || doc.attributes?.nome || 'Sem título';
                console.log(`  ${index + 1}. ID: ${doc.id} | Título: "${titulo}"`);
            });
            
            // Filtrar por título do documento esperado (igual à rota original)
            documentosEncontrados = todosDocumentos.filter(doc => {
                const tituloDoc = doc.attributes?.titulo || doc.attributes?.nome || '';
                const tituloEsperado = info.tituloDocumentoEsperado.toLowerCase();
                
                // Match exato ou parcial por título
                const matchExato = tituloDoc.toLowerCase() === tituloEsperado;
                const matchParcial = tituloDoc.toLowerCase().includes(tituloEsperado) || 
                                   tituloEsperado.includes(tituloDoc.toLowerCase());
                
                if (matchExato) {
                    console.log(`✅ MATCH EXATO: "${tituloDoc}" = "${info.tituloDocumentoEsperado}"`);
                } else if (matchParcial) {
                    console.log(`✅ MATCH PARCIAL: "${tituloDoc}" contém "${info.tituloDocumentoEsperado}"`);
                } else {
                    console.log(`❌ SEM MATCH: "${tituloDoc}" não corresponde a "${info.tituloDocumentoEsperado}"`);
                }
                
                return matchExato || matchParcial;
            });
            
            console.log(`🎯 Documentos após filtro por título: ${documentosEncontrados.length}`);
        } catch (error) {
            console.error("❌ Erro ao buscar documentos:", error);
        }

        if (documentosEncontrados.length === 0) {
            return res.json({
                success: false,
                message: "Nenhum documento encontrado para este cliente"
            });
        }

        // Processar documentos encontrados
        let melhorDocumento = null;
        let melhorScore = 0;
        
        console.log(`\n🔍 Analisando ${documentosEncontrados.length} documentos...`);
        
        for (let i = 0; i < documentosEncontrados.length; i++) {
            const doc = documentosEncontrados[i];
            console.log(`\n📄 Analisando documento ${i + 1}/${documentosEncontrados.length}:`);
            console.log(`   ID: ${doc.id}`);
            console.log(`   Título: "${doc.attributes?.titulo || doc.attributes?.nome || 'Sem título'}"`);
            
            try {
                const conteudoResult = await obterConteudoDocumento(doc.id, empresaId);
                if (conteudoResult.success && conteudoResult.data) {
                    doc.conteudo = conteudoResult.data;
                    console.log(`   ✅ Conteúdo obtido com sucesso`);
                    
                    // Fazer match com PDF Layout se configurado (igual à rota original)
                    if (info.pdfLayoutId && doc.conteudo) {
                        const textoPDF = await extrairTextoDoPDF(doc.conteudo);
                        if (textoPDF) {
                            const linhas = quebrarTextoInteligente(textoPDF);
                            const textoCompleto = linhas.join(" ");
                            
                            console.log(`   🔍 Fazendo match com PDF Layout ID: ${info.pdfLayoutId}`);
                            const resultadoMatch = await fazerMatchComPDFLayout(textoCompleto, linhas, info.pdfLayoutId, empresaId, obrigacaoClienteId);
                            
                            console.log(`   📊 Resultado do match:`, {
                                sucesso: resultadoMatch.sucesso,
                                motivo: resultadoMatch.motivo,
                                dados: resultadoMatch.dados
                            });
                            
                            if (resultadoMatch.sucesso) {
                                doc.pdfLayoutMatch = resultadoMatch.dados;
                                const score = calcularScoreMatch(resultadoMatch.dados);
                                console.log(`   ✅ MATCH PDF LAYOUT: Score ${score}`);
                                
                                if (score > melhorScore) {
                                    melhorScore = score;
                                    melhorDocumento = doc;
                                    console.log(`   🏆 NOVO MELHOR DOCUMENTO! Score: ${score}`);
                                }
                            } else {
                                console.log(`   ❌ SEM MATCH PDF LAYOUT: ${resultadoMatch.motivo || 'Motivo não especificado'}`);
                            }
                        } else {
                            console.log(`   ❌ Falha ao extrair texto do PDF`);
                        }
                    } else if (doc.conteudo) {
                        // Score básico para documentos sem validação (igual à rota original)
                        const score = 1;
                        console.log(`   📊 Score básico: ${score} (sem PDF Layout configurado)`);
                        
                        if (score > melhorScore) {
                            melhorScore = score;
                            melhorDocumento = doc;
                            console.log(`   🏆 NOVO MELHOR DOCUMENTO! Score: ${score}`);
                        }
                    }
                } else {
                    console.log(`   ❌ Falha ao obter conteúdo do documento`);
                }
            } catch (error) {
                console.error(`   ❌ Erro ao processar documento ${doc.id}:`, error);
            }
        }

        console.log(`\n📊 RESUMO FINAL:`);
        console.log(`   Documentos analisados: ${documentosEncontrados.length}`);
        console.log(`   Melhor score encontrado: ${melhorScore}`);
        
        if (melhorDocumento) {
            console.log(`   ✅ DOCUMENTO VÁLIDO ENCONTRADO!`);
            console.log(`   📄 ID: ${melhorDocumento.id}`);
            console.log(`   📝 Título: "${melhorDocumento.attributes?.titulo || melhorDocumento.attributes?.nome}"`);
            console.log(`   🏆 Score: ${melhorScore}`);
            
            // Salvar o melhor documento (igual à rota original)
            const nomeArquivo = melhorDocumento.pdfLayoutMatch 
                ? `${info.tituloDocumentoEsperado}_${melhorDocumento.pdfLayoutMatch.obrigacao}_${melhorDocumento.pdfLayoutMatch.competencia}_${melhorDocumento.id}.pdf`
                : `${info.tituloDocumentoEsperado}_${melhorDocumento.id}.pdf`;
            
            console.log(`   💾 Salvando como: ${nomeArquivo}`);

            // Salvar na tabela arquivos_baixados_automaticamente
            await db.query(`
                INSERT INTO arquivos_baixados_automaticamente 
                (empresaId, clienteId, atividadeId, base64, nomeArquivo)
                VALUES (?, ?, ?, ?, ?)
            `, [empresaId, info.clienteId, info.atividadeId, melhorDocumento.conteudo, nomeArquivo]);

            // Atualizar a atividade (igual à rota original)
            const { dataHora } = getDataHoraServidor();
            await db.query(`
                UPDATE obrigacoes_atividades_clientes 
                SET anexo = ?, nomeArquivo = ?, concluida = 1, dataConclusao = ?
                WHERE id = ?
            `, [melhorDocumento.conteudo, nomeArquivo, dataHora, info.atividadeId]);

            console.log(`   ✅ Documento salvo e atividade atualizada!`);

            // Adicionar comentário automático resumido
            const detalhesMatch = melhorDocumento.pdfLayoutMatch ? {
                obrigacao: melhorDocumento.pdfLayoutMatch.obrigacao,
                competencia: melhorDocumento.pdfLayoutMatch.competencia,
                cnpj: melhorDocumento.pdfLayoutMatch.cnpj,
                score: melhorScore
            } : null;

            const comentarioResumido = `Baixa automática completa com integração eContador realizada com sucesso.\n\n` +
                `Documento: "${melhorDocumento.attributes?.titulo || melhorDocumento.attributes?.nome}"\n` +
                `ID: ${melhorDocumento.id}\n` +
                `Score: ${melhorScore}/50\n` +
                (detalhesMatch ? 
                    `Dados extraídos: ${detalhesMatch.obrigacao} - ${detalhesMatch.competencia} - ${detalhesMatch.cnpj}\n` :
                    `Validação: Documento aceito sem validação específica\n`
                ) +
                `Processado em: ${new Date().toLocaleString('pt-BR')}`;

            // Inserir comentário na tabela comentarios_obrigacao
            await db.query(`
                INSERT INTO comentarios_obrigacao 
                (obrigacaoid, usuarioid, comentario, criadoEm, tipo) 
                VALUES (?, ?, ?, NOW(), 'sistema')
            `, [obrigacaoClienteId, req.usuario?.id || 1, comentarioResumido]);

            console.log(`   Comentário automático adicionado!`);

            return res.json({
                success: true,
                message: "Match encontrado e atividade concluída com sucesso",
                data: {
                    documentoId: melhorDocumento.id,
                    titulo: melhorDocumento.attributes?.titulo || melhorDocumento.attributes?.nome,
                    score: melhorScore
                }
            });
        } else {
            console.log(`   ❌ NENHUM DOCUMENTO VÁLIDO ENCONTRADO`);
            
            return res.json({
                success: false,
                message: "Nenhum documento válido encontrado",
                data: {
                    documentosAnalisados: documentosEncontrados.length,
                    melhorScore: melhorScore
                }
            });
        }

    } catch (error) {
        console.error("Erro na busca automática por CNPJ:", error);
        res.status(500).json({ 
            success: false, 
            message: "Erro interno no processo de busca automática",
            error: error.message
        });
    }
});

module.exports = router;

