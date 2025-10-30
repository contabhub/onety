const express = require('express');
const { onvioService } = require('../../services/gestao/onvioService');
const autenticarToken = require("../../middlewares/auth");
const db = require('../../config/database');
const { authenticator } = require("otplib");


const router = express.Router();


/**
 * 📥 Baixar atividades automaticamente da Onvio
 */
router.post('/baixar-atividades', autenticarToken, async (req, res) => {
    try {
        const empresaId = req.usuario?.empresaId;
        
        if (!empresaId) {
            return res.status(400).json({ 
                success: false, 
                message: "Empresa ID é obrigatório" 
            });
        }

        console.log(`🚀 Iniciando baixa automática de atividades da Onvio para empresa ID: ${empresaId}`);
        
        // Verificar se tem credenciais configuradas
        const credenciais = await obterCredenciaisOnvio(empresaId);
        if (!credenciais) {
            return res.status(400).json({
                success: false,
                message: "Credenciais da Onvio não configuradas para esta empresa"
            });
        }

        // Buscar atividades base do tipo "Integração: Onvio"
        const [atividadesBase] = await db.query(`
            SELECT
                ao.id AS atividadeBaseId,
                ao.texto AS atividadeTexto,
                ao.titulo_documento AS tituloDocumentoEsperado,
                ao.pdf_layout_id AS pdfLayoutId,
                o.id AS obrigacaoBaseId,
                o.nome AS obrigacaoNome
            FROM atividades_obrigacao ao
            JOIN obrigacoes o ON ao.obrigacaoId = o.id
            WHERE ao.tipo = 'Integração: Onvio'
            AND o.empresaId = ?
        `, [empresaId]);

        if (atividadesBase.length === 0) {
            return res.json({
                success: true,
                message: "Nenhuma atividade base 'Integração: Onvio' encontrada.",
                detalhes: []
            });
        }

        console.log(`🔍 Encontradas ${atividadesBase.length} atividades base de integração Onvio.`);
        
        // Agrupar atividades de clientes por clienteId
        let atividadesPorCliente = {};
        let clientesInfo = {};
        for (const atividadeBase of atividadesBase) {
            const [atividadesCliente] = await db.query(`
                SELECT oac.id, oac.concluida, oac.obrigacaoClienteId, oac.texto, oac.descricao, oac.tipo, 
                       o.nome as obrigacao_nome, c.nome as cliente_nome, c.id as clienteId, c.cnpjCpf as clienteCnpjCpf,
                       oc.status as obrigacaoClienteStatus, oc.baixadaAutomaticamente as obrigacaoClienteBaixadaAutomaticamente,
                       oc.ano_referencia, oc.mes_referencia
                FROM obrigacoes_atividades_clientes oac
                JOIN obrigacoes_clientes oc ON oac.obrigacaoClienteId = oc.id
                JOIN obrigacoes o ON oc.obrigacaoId = o.id
                JOIN clientes c ON oc.clienteId = c.id
                WHERE oc.obrigacaoId = ?
                AND oac.texto = ?
                AND oac.tipo = 'Integração: Onvio'
                AND oac.concluida = 0
                AND oc.status != 'concluida'
                AND oc.baixadaAutomaticamente = 0
            `, [atividadeBase.obrigacaoBaseId, atividadeBase.atividadeTexto]);
            for (const atividadeCliente of atividadesCliente) {
                if (!atividadesPorCliente[atividadeCliente.clienteId]) {
                    atividadesPorCliente[atividadeCliente.clienteId] = [];
                    clientesInfo[atividadeCliente.clienteId] = {
                        id: atividadeCliente.clienteId,
                        nome: atividadeCliente.cliente_nome,
                        cnpjCpf: atividadeCliente.clienteCnpjCpf
                    };
                }
                atividadesPorCliente[atividadeCliente.clienteId].push({
                    ...atividadeCliente,
                    tituloDocumentoEsperado: atividadeBase.tituloDocumentoEsperado,
                    pdfLayoutId: atividadeBase.pdfLayoutId
                });
            }
        }
        const clientes = Object.values(clientesInfo);
        console.log(`👥 Total de clientes a processar: ${clientes.length}`);

        // Função para processar um cliente (sessão única)
        async function processarCliente(cliente, atividades, credenciais, empresaId) {
            const { OnvioService } = require('../services/onvioService');
            const onvioService = new OnvioService(req.usuario.id);
            const resultados = [];
            
            try {
                // ✅ CORREÇÃO: Usar o método do OnvioService para criar browser
                // Isso garante que browser e page sejam corretamente associados ao serviço
                await onvioService.initializeBrowser();
                await onvioService.fazerLogin(credenciais, true, empresaId);
                await onvioService.selecionarClientePorCNPJ(cliente.cnpjCpf);

                // Para cada atividade, navegar para o caminho correto e buscar documentos
                for (const atividade of atividades) {
                    try {
                        let competencia = null;
                        if (atividade.ano_referencia && atividade.mes_referencia) {
                            competencia = formatarCompetencia(atividade.mes_referencia, atividade.ano_referencia, 'mm/yyyy');
                        }
                        // Navegar para o caminho da sidebar (pasta correta) só no início da atividade
                        if (atividade.tituloDocumentoEsperado) {
                            await onvioService.navegarPelaSidebar(atividade.tituloDocumentoEsperado, competencia, atividade.obrigacaoClienteId, empresaId);
                        }
                        // Buscar documentos na pasta
                        let documentosAtualizados = await onvioService.extrairDocumentos(5, 2000);
                        // LOG
                        console.log(`📄 [${cliente.nome}] Documentos encontrados na pasta '${atividade.tituloDocumentoEsperado}': ${documentosAtualizados.length}`);
                        if (documentosAtualizados.length > 0) {
                            documentosAtualizados.forEach((doc, idx) => {
                                console.log(`    [${cliente.nome}] Documento ${idx + 1}: ${doc.titulo || doc.nome}`);
                            });
                        }
                        // Lógica de match igual já existe: pelo nome e competência
                        const matches = documentosAtualizados.filter(doc => {
                            const nomeDoc = (doc.titulo || doc.nome || '').toLowerCase();
                            const tituloEsperado = (atividade.tituloDocumentoEsperado || '').toLowerCase();
                            let matchNome = false;
                            if (tituloEsperado && nomeDoc.includes(tituloEsperado)) {
                                matchNome = true;
                            }
                            // Competência
                            let matchCompetencia = false;
                            if (competencia && nomeDoc.includes(competencia.replace('/', ''))) {
                                matchCompetencia = true;
                            } else if (competencia && nomeDoc.includes(competencia.replace('/', '-'))) {
                                matchCompetencia = true;
                            } else if (competencia && nomeDoc.includes(competencia.replace('/', '.'))) {
                                matchCompetencia = true;
                            } else if (competencia && nomeDoc.includes(competencia)) {
                                matchCompetencia = true;
                            }
                            return matchNome || matchCompetencia;
                        });
                        // LOG: Matches encontrados
                        if (matches.length > 0) {
                            console.log(`[${cliente.nome}] Documentos que deram match para atividade ${atividade.id}:`, matches.map(d => d.titulo || d.nome));
                        } else {
                            console.log(`[${cliente.nome}] Nenhum documento deu match para atividade ${atividade.id}`);
                        }
                        if (matches.length > 0) {
                            const matchesDetalhados = [];
                            let concluiuAtividade = false;
                            for (const doc of matches) {
                                let docAtual = null;
                                let tentativas = 0;
                                let resultadoBaixa = null;
                                while (!docAtual && tentativas < 2) {
                                    // 1ª tentativa: só extrai os arquivos da pasta (sem sidebar)
                                    const documentosAtualizados = await onvioService.extrairDocumentos(5, 2000);
                                    docAtual = documentosAtualizados.find(d => (d.titulo || d.nome) === (doc.titulo || doc.nome));
                                    tentativas++;
                                    if (!docAtual) {
                                        // Se não encontrou, tenta navegar pela sidebar e extrair de novo
                                        if (atividade.tituloDocumentoEsperado) {
                                            await onvioService.navegarPelaSidebar(atividade.tituloDocumentoEsperado, competencia, atividade.obrigacaoClienteId, empresaId);
                                        }
                                    }
                                }
                                if (docAtual) {
                                    try {
                                        // Tentar clicar até 5 vezes no documento
                                        let clicou = false;
                                        for (let tentativaClique = 1; tentativaClique <= 5; tentativaClique++) {
                                            try {
                                                if (docAtual.elemento && typeof docAtual.elemento.click === 'function') {
                                                    await docAtual.elemento.click();
                                                } else {
                                                    await onvioService.tentarCliqueRobusto(docAtual.elemento, docAtual.titulo || docAtual.nome);
                                                }
                                                clicou = true;
                                                console.log(`[${cliente.nome}] Clique realizado no documento (${tentativaClique}ª tentativa): ${docAtual.titulo || docAtual.nome}`);
                                                break;
                                            } catch (erro) {
                                                console.log(`[${cliente.nome}] Falha ao clicar no documento (${tentativaClique}ª tentativa): ${docAtual.titulo || docAtual.nome}`, erro);
                                                await new Promise(resolve => setTimeout(resolve, 300));
                                            }
                                        }
                                        if (!clicou) {
                                            console.log(`[${cliente.nome}] Não foi possível clicar no documento após 5 tentativas: ${docAtual.titulo || docAtual.nome}`);
                                            // Pode seguir para o próximo documento ou marcar como erro
                                            continue;
                                        }
                                        // Tenta aguardar carregamento do documento até 2 vezes
                                        let carregou = false;
                                        // Continuar clicando até carregar de fato (sem seguir mesmo assim)
                                        for (let i = 0; i < 6; i++) {
                                            carregou = await onvioService.aguardarCarregamentoDocumento(3, docAtual.titulo || docAtual.nome);
                                            if (carregou) break;
                                            console.log(`[${cliente.nome}] Documento não carregou na tentativa ${i + 1}, tentando novo duplo clique...`);
                                            try {
                                                if (docAtual.elemento && typeof docAtual.elemento.click === 'function') {
                                                    await docAtual.elemento.click({ clickCount: 2, delay: 20 });
                                                } else {
                                                    await onvioService.tentarCliqueRobusto(docAtual.elemento, docAtual.titulo || docAtual.nome);
                                                }
                                            } catch (_) {}
                                            await new Promise(resolve => setTimeout(resolve, 500));
                                        }
                                        if (!carregou) {
                                            console.log(`[${cliente.nome}] Documento não confirmou carregamento. Abortando esta atividade sem concluir.`);
                                            resultadoBaixa = {
                                                arquivo: docAtual.titulo || docAtual.nome,
                                                erro: 'Documento não abriu (sem /document/)',
                                                carregamentoForcado: false,
                                                sucesso: false
                                            };
                                        } else {
                                            resultadoBaixa = await processarBaixaDocumento(docAtual, atividade, cliente, competencia, onvioService.page, false, onvioService);
                                        }
                                    } catch (erro) {
                                        console.log(`[${cliente.nome}] Erro ao clicar/processar documento: ${docAtual.titulo || docAtual.nome}`, erro);
                                        resultadoBaixa = {
                                            arquivo: docAtual.titulo || docAtual.nome,
                                            erro: erro.message || erro,
                                            carregamentoForcado: false,
                                            sucesso: false
                                        };
                                    }
                                    // Após processar, goBack para a listagem
                                    try {
                                        await onvioService.page.goBack({ waitUntil: 'domcontentloaded' });
                                        await new Promise(resolve => setTimeout(resolve, 1000));
                                    } catch (goBackError) {
                                        console.log(`⚠️ Erro ao voltar para listagem:`, goBackError);
                                    }
                                } else {
                                    resultadoBaixa = {
                                        arquivo: doc.titulo || doc.nome,
                                        erro: 'Documento não encontrado após tentativas',
                                        carregamentoForcado: false,
                                        sucesso: false
                                    };
                                }
                                // Adiciona o resultado ao array de resultados da atividade
                                if (!atividade.resultadosBaixa) atividade.resultadosBaixa = [];
                                atividade.resultadosBaixa.push(resultadoBaixa);

                                // Se concluiu com sucesso, parar imediatamente de processar outros docs desta atividade
                                if (resultadoBaixa && resultadoBaixa.sucesso) {
                                    concluiuAtividade = true;
                                    console.log(`[${cliente.nome}] ✅ Atividade ${atividade.id} concluída com sucesso. Encerrando execução desta atividade.`);
                                    break;
                                }
                            }
                            resultados.push({
                                atividadeId: atividade.id,
                                success: true,
                                matches: matchesDetalhados
                            });
                            // Interromper após a primeira atividade concluída com sucesso
                            if (concluiuAtividade) break;
                        } else {
                            resultados.push({
                                atividadeId: atividade.id,
                                success: false,
                                message: "Documento não encontrado ou título não confere",
                                documentosDisponiveis: documentosAtualizados.map(d => d.titulo || d.nome)
                            });
                        }
                    } catch (e) {
                        resultados.push({ atividadeId: atividade.id, success: false, erro: e.message });
                    }
                }
                return { clienteId: cliente.id, clienteNome: cliente.nome, sucesso: true, resultados };
            } catch (e) {
                console.error(`❌ Erro ao processar cliente ${cliente.nome}:`, e);
                return { clienteId: cliente.id, clienteNome: cliente.nome, sucesso: false, erro: e.message, resultados };
            } finally {
                // ✅ CORREÇÃO CRÍTICA: Fechar navegador usando o método do OnvioService
                // Isso garante que todos os recursos sejam liberados corretamente
                try {
                    await onvioService.fecharNavegador();
                    console.log(`🔒 Navegador fechado para cliente: ${cliente.nome}`);
                } catch (closeError) {
                    console.error(`⚠️ Erro ao fechar navegador para ${cliente.nome}:`, closeError);
                }
                
                // Aguardar um pouco para garantir que o processo foi terminado
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }

        // Função de pool de paralelismo
        async function processarClientesEmPool(clientes, atividadesPorCliente, credenciais, empresaId, maxParalelos = 5) {
            const resultados = [];
            let index = 0;
            async function next() {
                if (index >= clientes.length) return;
                const cliente = clientes[index++];
                const atividades = atividadesPorCliente[cliente.id];
                const resultado = await processarCliente(cliente, atividades, credenciais, empresaId);
                resultados.push(resultado);
                await next();
            }
            const pool = [];
            for (let i = 0; i < Math.min(maxParalelos, clientes.length); i++) pool.push(next());
            await Promise.all(pool);
            return resultados;
        }

        // ⚡ OTIMIZAÇÃO: Reduzir processos paralelos de 5 para 2 para economizar memória na VPS
        // Isso evita sobrecarga de processos Puppeteer simultâneos
        const resultadosProcessamento = await processarClientesEmPool(clientes, atividadesPorCliente, credenciais, empresaId, 2);
        const sucessos = resultadosProcessamento.filter(r => r.sucesso).length;
        const falhas = resultadosProcessamento.length - sucessos;
        res.json({
            success: true,
            message: `Processamento concluído: ${sucessos} clientes com sucesso, ${falhas} falhas` ,
            resumo: {
                total: resultadosProcessamento.length,
                sucessos,
                falhas
            },
            detalhes: resultadosProcessamento,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('❌ Erro ao baixar atividades da Onvio:', error);
        res.status(500).json({
            success: false,
            message: `Erro ao baixar atividades: ${error.message}`,
            error: error.message
        });
    }
});

/**
 * ⚙️ Configurar credenciais da Onvio para uma empresa
 */
router.post('/configurar-credenciais', autenticarToken, async (req, res) => {
    try {
        const { email, senha, mfaSecret, onvioCodigoAutenticacao } = req.body;
        const empresaId = req.usuario?.empresaId;
        
        if (!email || !senha || !empresaId) {
            return res.status(400).json({
                success: false,
                message: "Email, senha e empresa são obrigatórios"
            });
        }

        // Salvar credenciais (criptografadas)
        await salvarCredenciaisOnvio(empresaId, email, senha, mfaSecret, onvioCodigoAutenticacao);
        
        res.json({
            success: true,
            message: "✅ Credenciais da Onvio configuradas com sucesso!",
            detalhes: {
                empresaId,
                email: email.substring(0, 3) + '***',
                secretConfigurado: !!mfaSecret,
                codigoAutenticacaoSalvo: !!onvioCodigoAutenticacao,
                timestamp: new Date().toISOString()
            }
        });
        
    } catch (error) {
        console.error('❌ Erro ao configurar credenciais:', error);
        res.status(500).json({
            success: false,
            message: `Erro ao configurar credenciais: ${error.message}`,
            error: error.message
        });
    }
});

/**
 * 🔑 Gerar código TOTP da Onvio
 */
router.get('/gerar-codigo/:empresaId', autenticarToken, async (req, res) => {
    try {
        const { empresaId } = req.params;

        // Buscar secret salvo no banco
        const credenciais = await obterCredenciaisOnvio(empresaId);
        if (!credenciais?.mfaSecret) {
            return res.status(400).json({
                success: false,
                message: "❌ Nenhum secret configurado para essa empresa"
            });
        }

        const code = authenticator.generate(credenciais.mfaSecret);

        res.json({
            success: true,
            code,
            validadeSegundos: 30 - (Math.floor(Date.now() / 1000) % 30) // tempo restante do código
        });

    } catch (error) {
        console.error('❌ Erro ao gerar código:', error);
        res.status(500).json({
            success: false,
            message: `Erro ao gerar código: ${error.message}`,
            error: error.message
        });
    }
});

/**
 * 📊 Obter status da integração Onvio
 */

// ===== FUNÇÕES AUXILIARES =====

/**
 * 📅 Formatar competência de forma inteligente e flexível
 * Detecta automaticamente formatos: mm/yyyy, mmyyyy, myyyy, mm-yyyy, mm.yyyy, etc.
 */
function formatarCompetencia(mes, ano, formatoPreferido = 'mm/yyyy') {
    try {
        if (!mes || !ano) {
            return null;
        }
        
        const mesNum = parseInt(mes);
        const anoNum = parseInt(ano);
        
        if (isNaN(mesNum) || isNaN(anoNum)) {
            return null;
        }
        
        if (formatoPreferido === 'mmyyyy') {
            // Formato: mmyyyy (ex: 072025)
            return mesNum.toString().padStart(2, '0') + anoNum.toString();
        } else {
            // Formato padrão: mm/yyyy (ex: 7/2025)
            return `${mesNum}/${anoNum}`;
        }
    } catch (error) {
        console.error('❌ Erro ao formatar competência:', error);
        return null;
    }
}

/**
 * 🧠 Detecta automaticamente o formato de competência em um texto
 * Aceita qualquer formato: mm/yyyy, mmyyyy, myyyy, mm-yyyy, mm.yyyy, etc.
 */
function detectarCompetenciaAutomaticamente(texto) {
    try {
        if (!texto || typeof texto !== 'string') {
            return null;
        }
        
        console.log(`🔍 Detectando competência automaticamente em: "${texto}"`);
        
        // Padrões para detectar competência
        const padroes = [
            // mm/yyyy ou m/yyyy (ex: 07/2025, 7/2025)
            /(\d{1,2})\/(\d{4})/,
            // mmyyyy (ex: 072025)
            /(\d{2})(\d{4})/,
            // myyyy (ex: 72025)
            /(\d{1})(\d{4})/,
            // mm-yyyy ou m-yyyy (ex: 07-2025, 7-2025)
            /(\d{1,2})-(\d{4})/,
            // mm.yyyy ou m.yyyy (ex: 07.2025, 7.2025)
            /(\d{1,2})\.(\d{4})/,
            // mm yyyy ou m yyyy (ex: 07 2025, 7 2025)
            /(\d{1,2})\s+(\d{4})/,
            // yyyy-mm (ex: 2025-07)
            /(\d{4})-(\d{1,2})/,
            // yyyy/mm (ex: 2025/07)
            /(\d{4})\/(\d{1,2})/,
            // yyyy.mm (ex: 2025.07)
            /(\d{4})\.(\d{1,2})/,
            // yyyy mm (ex: 2025 07)
            /(\d{4})\s+(\d{1,2})/
        ];
        
        for (const padrao of padroes) {
            const match = texto.match(padrao);
            if (match) {
                let mes, ano;
                
                // Verificar se é formato ano-mês ou mês-ano
                if (match[1].length === 4) {
                    // Formato: yyyy-mm, yyyy/mm, yyyy.mm, yyyy mm
                    ano = parseInt(match[1]);
                    mes = parseInt(match[2]);
                } else {
                    // Formato: mm-yyyy, mm/yyyy, mm.yyyy, mm yyyy, mmyyyy, myyyy
                    mes = parseInt(match[1]);
                    ano = parseInt(match[2]);
                }
                
                // Validar mês e ano
                if (mes >= 1 && mes <= 12 && ano >= 2000 && ano <= 2100) {
                    console.log(`✅ Competência detectada: mês ${mes}, ano ${ano} (padrão: ${padrao.source})`);
                    return { mes, ano, padrao: padrao.source };
                }
            }
        }
        
        console.log(`⚠️ Nenhuma competência válida detectada em: "${texto}"`);
        return null;
        
    } catch (error) {
        console.error('❌ Erro ao detectar competência automaticamente:', error);
        return null;
    }
}

/**
 * 🔍 Filtra documentos por competência usando detecção automática
 * Aceita qualquer formato de competência nos nomes dos arquivos
 */
function filtrarDocumentosPorCompetenciaInteligente(documentos, competenciaEsperada) {
    try {
        console.log(`🧠 Filtrando ${documentos.length} documentos com detecção automática de competência`);
        console.log(`🎯 Competência esperada: ${competenciaEsperada}`);
        
        // Primeiro, tentar detectar a competência esperada
        const competenciaDetectada = detectarCompetenciaAutomaticamente(competenciaEsperada);
        if (!competenciaDetectada) {
            console.log(`⚠️ Não foi possível detectar competência em: ${competenciaEsperada}`);
            return [];
        }
        
        const { mes, ano } = competenciaDetectada;
        console.log(`📅 Buscando documentos com mês: ${mes}, ano: ${ano}`);
        
        const documentosFiltrados = documentos.filter(documento => {
            const nome = documento.nome || documento;
            
            // Detectar competência no nome do arquivo
            const competenciaArquivo = detectarCompetenciaAutomaticamente(nome);
            if (!competenciaArquivo) {
                return false;
            }
            
            // Comparar mês e ano
            const match = competenciaArquivo.mes === mes && competenciaArquivo.ano === ano;
            
            if (match) {
                console.log(`✅ Documento "${nome}" corresponde à competência ${mes}/${ano}`);
            }
            
            return match;
        });
        
        console.log(`✅ Filtrados ${documentosFiltrados.length} documentos para competência ${mes}/${ano}`);
        return documentosFiltrados;
        
    } catch (error) {
        console.error('❌ Erro ao filtrar documentos com detecção automática:', error);
        return [];
    }
}

/**
 * 💾 Salvar credenciais Onvio na tabela empresas
 */
async function salvarCredenciaisOnvio(empresaId, email, senha, mfaSecret, onvioCodigoAutenticacao) {
    try {
        // Criptografar senha (implementar criptografia adequada em produção)
        const senhaCriptografada = Buffer.from(senha).toString('base64');
        let query = 'UPDATE empresas SET onvioLogin = ?, onvioSenha = ?';
        let params = [email, senhaCriptografada];
        if (mfaSecret) {
            query += ', onvioMfaSecret = ?';
            params.push(mfaSecret);
        }
        if (onvioCodigoAutenticacao) {
            query += ', onvioCodigoAutenticacao = ?';
            params.push(onvioCodigoAutenticacao);
        }
        query += ' WHERE id = ?';
        params.push(empresaId);
        await db.query(query, params);
        console.log(`✅ Credenciais Onvio salvas na tabela empresas para empresa ID: ${empresaId}`);
    } catch (error) {
        console.error('❌ Erro ao salvar credenciais Onvio:', error);
        throw error;
    }
}

/**
 * 🔑 Obter credenciais da Onvio da tabela empresas (descriptografadas)
 */
async function obterCredenciaisOnvio(empresaId) {
    try {
        const [credenciais] = await db.query(
            'SELECT onvioLogin, onvioSenha, onvioMfaSecret FROM empresas WHERE id = ?',
            [empresaId]
        );
        if (credenciais.length === 0 || !credenciais[0].onvioLogin || !credenciais[0].onvioSenha) {
            console.log(`⚠️ Credenciais Onvio incompletas para empresa ${empresaId}: email=${!!credenciais[0].onvioLogin}, senha=${!!credenciais[0].onvioSenha}`);
            return null;
        }
        const credencial = credenciais[0];
        // Descriptografar senha (se estiver em base64)
        let senhaDescriptografada;
        try {
            senhaDescriptografada = Buffer.from(credencial.onvioSenha, 'base64').toString();
        } catch (e) {
            senhaDescriptografada = credencial.onvioSenha;
        }
        return {
            email: credencial.onvioLogin,
            senha: senhaDescriptografada,
            mfaSecret: credencial.onvioMfaSecret || null
        };
    } catch (error) {
        console.error('❌ Erro ao obter credenciais Onvio:', error);
        return null;
    }
}

/**
 * ✅ Verificar se empresa tem credenciais Onvio configuradas na tabela empresas
 */
async function verificarSeTemCredenciaisOnvio(empresaId) {
    try {
        const [resultado] = await db.query(
            'SELECT COUNT(*) as total FROM empresas WHERE id = ? AND onvioLogin IS NOT NULL AND onvioSenha IS NOT NULL',
            [empresaId]
        );
        
        return resultado[0].total > 0;
        
    } catch (error) {
        console.error('❌ Erro ao verificar credenciais Onvio:', error);
        return false;
    }
}

/**
 * 🔄 Processar uma atividade base específica
 */
async function processarAtividadeBase(atividadeBase, empresaId) {
    try {
        const { atividadeBaseId, atividadeTexto, tituloDocumentoEsperado, pdfLayoutId, obrigacaoBaseId, obrigacaoNome } = atividadeBase;
        
        console.log(`    🔍 Processando atividade base: "${atividadeTexto}"`);
        
        // Buscar atividades do cliente que correspondem a esta atividade base
        const [atividadesCliente] = await db.query(`
            SELECT oac.id, oac.concluida, oac.obrigacaoClienteId, oac.texto, oac.descricao, oac.tipo, 
                   o.nome as obrigacao_nome, c.nome as cliente_nome, c.id as clienteId, c.cnpjCpf as clienteCnpjCpf,
                   oc.status as obrigacaoClienteStatus, oc.baixadaAutomaticamente as obrigacaoClienteBaixadaAutomaticamente
            FROM obrigacoes_atividades_clientes oac
            JOIN obrigacoes_clientes oc ON oac.obrigacaoClienteId = oc.id
            JOIN obrigacoes o ON oc.obrigacaoId = o.id
            JOIN clientes c ON oc.clienteId = c.id
            WHERE oc.obrigacaoId = ?
            AND oac.texto = ?
            AND oac.tipo = 'Integração: Onvio'
            AND oac.concluida = 0
            AND oc.status != 'concluida'
            AND oc.baixadaAutomaticamente = 0
        `, [obrigacaoBaseId, atividadeTexto]);
        
        if (atividadesCliente.length === 0) {
            console.log(`    ⚠️ Nenhuma atividade do cliente encontrada para atividade base: "${atividadeTexto}"`);
            return {
                atividadeBaseId,
                atividadeTexto,
                success: true,
                message: "Nenhuma atividade pendente encontrada",
                processadas: 0
            };
        }
        
        console.log(`    🔍 Encontradas ${atividadesCliente.length} atividades do cliente para atividade base: "${atividadeTexto}"`);
        
        let processadas = 0;
        let sucessos = 0;
        
        for (const atividadeCliente of atividadesCliente) {
            try {
                const resultado = await processarAtividadeCliente(atividadeCliente, tituloDocumentoEsperado, pdfLayoutId, empresaId);
                
                if (resultado.success) {
                    sucessos++;
                }
                
                processadas++;
                
            } catch (error) {
                console.error(`    ❌ Erro ao processar atividade ${atividadeCliente.id}:`, error);
            }
        }
        
        return {
            atividadeBaseId,
            atividadeTexto,
            success: true,
            message: `Processadas ${processadas} atividades, ${sucessos} com sucesso`,
            processadas,
            sucessos,
            falhas: processadas - sucessos
        };
        
    } catch (error) {
        console.error(`❌ Erro ao processar atividade base ${atividadeBase.atividadeBaseId}:`, error);
        return {
            atividadeBaseId: atividadeBase.atividadeBaseId,
            atividadeTexto: atividadeBase.atividadeTexto,
            success: false,
            message: `Erro: ${error.message}`,
            error: error.message
        };
    }
}

/**
 * 🔄 Processar uma atividade específica do cliente
 */
async function processarAtividadeCliente(atividadeCliente, tituloDocumentoEsperado, pdfLayoutId, empresaId, onvioService) {
    try {
        const { id, obrigacaoClienteId, clienteId, clienteCnpjCpf, clienteNome } = atividadeCliente;
        
        console.log(`        🔍 Processando atividade ${id} para cliente: ${clienteNome}`);
        
        // Buscar competência da obrigação do cliente
        const [competenciaInfo] = await db.query(`
            SELECT oc.ano_referencia, oc.mes_referencia
            FROM obrigacoes_clientes oc
            WHERE oc.id = ?
        `, [obrigacaoClienteId]);
        
        let competencia = null;
        if (competenciaInfo.length > 0 && competenciaInfo[0].ano_referencia && competenciaInfo[0].mes_referencia) {
            // 🆕 NOVO: Usar função de formatação flexível
            competencia = formatarCompetencia(competenciaInfo[0].mes_referencia, competenciaInfo[0].ano_referencia, 'mm/yyyy');
            console.log(`        📅 Competência encontrada: ${competencia}`);
        } else {
            console.log(`        ⚠️ Competência não encontrada para obrigação ${obrigacaoClienteId}`);
        }
        
        // Buscar documentos na Onvio
        console.log(`        🎯 Chamando buscarDocumentosEmpresa com automação para obrigação ${obrigacaoClienteId} e empresa ${empresaId}`);
        let documentos = await onvioService.buscarDocumentosEmpresa(
            clienteCnpjCpf, 
            null, // 🚀 NOVA ESTRATÉGIA: NÃO passar competência específica, deixar buscar TODAS!
            tituloDocumentoEsperado,
            null, // obrigacaoClienteId não disponível neste contexto
            empresaId, // 🎯 NOVO: Passar empresaId para automação
            clienteId // 🎯 NOVO: Passar clienteId para busca otimizada
        );
        
        // 🎯 CORREÇÃO: Garantir que documentos seja sempre um array
        if (!documentos) {
            console.log(`        ⚠️ Documentos retornados como undefined/null, convertendo para array vazio`);
            documentos = [];
        } else if (!Array.isArray(documentos)) {
            console.log(`        ⚠️ Documentos retornados como objeto único, convertendo para array`);
            documentos = [documentos];
        }
        
        console.log(`        📊 Documentos retornados: ${documentos.length}`);
        if (documentos.length > 0) {
            documentos.forEach((doc, index) => {
                console.log(`        📄 Documento ${index + 1}:`, {
                    titulo: doc.titulo,
                    tipo: doc.tipo,
                    matchImediato: doc.matchImediato,
                    atividadeConcluida: doc.atividadeConcluida,
                    comentarioInserido: doc.comentarioInserido,
                    erroMatch: doc.erroMatch
                });
            });
        }
        
        if (documentos.length === 0) {
            console.log(`        ⚠️ Nenhum documento encontrado para cliente: ${clienteNome}`);
            return { success: false, message: "Nenhum documento encontrado" };
        }
        
        // Tentar fazer match com o título esperado
        const documentoMatch = documentos.find(doc => 
            doc.titulo && doc.titulo.toLowerCase().includes(tituloDocumentoEsperado.toLowerCase())
        );
        
        if (documentoMatch) {
            console.log(`        ✅ Documento encontrado: "${documentoMatch.titulo}"`);
            
            // Marcar atividade como concluída
            await db.query(
                'UPDATE obrigacoes_atividades_clientes SET concluida = 1, dataConclusao = CONVERT_TZ(NOW(), \'+00:00\', \'-09:00\') WHERE id = ?',
                [id]
            );
            
            // Marcar obrigação como baixada automaticamente
            await db.query(
                'UPDATE obrigacoes_clientes SET baixadaAutomaticamente = 1 WHERE id = ?',
                [obrigacaoClienteId]
            );
            
            return { 
                success: true, 
                message: "Documento encontrado e atividade concluída",
                documento: documentoMatch
            };
        } else {
            console.log(`        ⚠️ Nenhum match encontrado para título esperado: "${tituloDocumentoEsperado}"`);
            return { 
                success: false, 
                message: "Documento não encontrado ou título não confere",
                documentosDisponiveis: documentos.map(d => d.titulo)
            };
        }
        
    } catch (error) {
        console.error(`❌ Erro ao processar atividade do cliente:`, error);
        throw error;
    }
}

/**
 * 🔍 Tentar fazer match entre documentos e atividades
 */
async function tentarMatchComAtividades(documentos, obrigacaoClienteId, empresaId) {
    try {
        // 🎯 CORREÇÃO: Garantir que documentos seja sempre um array válido
        if (!documentos) {
            console.log('⚠️ tentarMatchComAtividades: documentos é undefined/null, retornando erro');
            return { matchEncontrado: false, message: "Documentos não fornecidos" };
        }
        
        if (!Array.isArray(documentos)) {
            console.log('⚠️ tentarMatchComAtividades: documentos não é um array, convertendo...');
            documentos = [documentos];
        }
        
        // Buscar informações da obrigação - CORREÇÃO: usar obrigacaoId diretamente
        const [obrigacaoInfo] = await db.query(`
            SELECT oac.id AS atividadeId, oac.texto AS atividadeTexto, ao.titulo_documento AS tituloDocumentoEsperado,
                   ao.pdf_layout_id AS pdfLayoutId, o.id AS obrigacaoBaseId, o.nome AS obrigacaoNome,
                   oc.id AS obrigacaoClienteId, c.id AS clienteId, c.nome AS clienteNome, c.cnpjCpf AS clienteCnpjCpf,
                   oc.ano_referencia, oc.mes_referencia
            FROM obrigacoes_atividades_clientes oac
            JOIN obrigacoes_clientes oc ON oac.obrigacaoClienteId = oc.id
            JOIN obrigacoes o ON oc.obrigacaoId = o.id
            JOIN clientes c ON oc.clienteId = c.id
            JOIN atividades_obrigacao ao ON o.id = ao.obrigacaoId AND oac.tipo = ao.tipo
            WHERE oc.id = ? AND oac.tipo = 'Integração: Onvio' AND c.empresaId = ?
        `, [obrigacaoClienteId, empresaId]);

        if (obrigacaoInfo.length === 0) {
            return { matchEncontrado: false, message: "Atividade 'Integração: Onvio' não encontrada" };
        }

        const atividade = obrigacaoInfo[0];
        
        // Tentar fazer match com base na competência e título
        let documentoMatch = null;
        
        // Primeiro, verificar se há match imediato (arquivo encontrado durante navegação)
        documentoMatch = documentos.find(doc => doc.tipo === 'documento_encontrado_match_imediato');
        if (documentoMatch) {
            console.log(`🎯 MATCH IMEDIATO encontrado: "${documentoMatch.titulo}" - arquivo encontrado durante navegação!`);
        }
        
        // Se não há match imediato, tentar match por competência (mais preciso)
        if (!documentoMatch && atividade.ano_referencia && atividade.mes_referencia) {
            // 🆕 NOVO: Usar função de formatação flexível
            const competenciaEsperada = formatarCompetencia(atividade.mes_referencia, atividade.ano_referencia, 'mm/yyyy');
            documentoMatch = documentos.find(doc => 
                doc.competencia === competenciaEsperada && 
                doc.status === 'encontrado_com_link'
            );
            
            if (documentoMatch) {
                console.log(`✅ Match por competência encontrado: "${documentoMatch.titulo}" para competência: ${competenciaEsperada}`);
            }
        }
        
        // Se não encontrou por competência, tentar por título
        if (!documentoMatch) {
            documentoMatch = documentos.find(doc => 
                doc.titulo && doc.titulo.toLowerCase().includes(atividade.tituloDocumentoEsperado.toLowerCase())
            );
            
            if (documentoMatch) {
                console.log(`✅ Match por título encontrado: "${documentoMatch.titulo}" para atividade: "${atividade.atividadeTexto}"`);
            }
        }
        
        if (documentoMatch) {
            console.log(`✅ Match encontrado: "${documentoMatch.titulo}" para atividade: "${atividade.atividadeTexto}"`);
            
            // Se o documento tem link, salvar no comentarios_obrigacao
            if (documentoMatch.linkDocumento || documentoMatch.urlAtual || documentoMatch.href) {
                const linkDocumento = documentoMatch.linkDocumento || documentoMatch.urlAtual || documentoMatch.href;
                const comentario = `Documento encontrado automaticamente via integração Onvio: ${documentoMatch.titulo}\n\nLink: ${linkDocumento}\n\nData da busca: ${new Date().toLocaleString('pt-BR')}`;
                
                // Inserir comentário na tabela comentarios_obrigacao
                await db.query(`
                    INSERT INTO comentarios_obrigacao (obrigacaoId, usuarioId, comentario, tipo, criadoEm)
                    VALUES (?, ?, ?, ?, CONVERT_TZ(NOW(), '+00:00', '-09:00'))
                `, [atividade.obrigacaoBaseId, 46, comentario, 'usuario']);
                
                console.log(`💾 Comentário salvo no banco com link do documento`);
            }
            
            // Marcar atividade como concluída
            await db.query(
                'UPDATE obrigacoes_atividades_clientes SET concluida = 1, dataConclusao = CONVERT_TZ(NOW(), \'+00:00\', \'-09:00\') WHERE id = ?',
                [atividade.atividadeId]
            );
            

            
            const mensagem = documentoMatch.tipo === 'documento_encontrado_match_imediato' 
                ? "Match IMEDIATO encontrado durante navegação, link salvo e atividade concluída"
                : "Match encontrado, link salvo e atividade concluída";
                
            return { 
                matchEncontrado: true, 
                atividadeId: atividade.atividadeId,
                documento: documentoMatch,
                linkSalvo: true,
                matchImediato: documentoMatch.tipo === 'documento_encontrado_match_imediato',
                message: mensagem
            };
        }
        
        return { 
            matchEncontrado: false, 
            message: "Nenhum match encontrado para o título esperado ou competência",
            tituloEsperado: atividade.tituloDocumentoEsperado,
            competenciaEsperada: atividade.ano_referencia && atividade.mes_referencia ? 
                `${atividade.mes_referencia}/${atividade.ano_referencia}` : 'Não especificada',
            documentosDisponiveis: documentos.map(d => ({
                titulo: d.titulo,
                competencia: d.competencia,
                status: d.status
            }))
        };
        
    } catch (error) {
        console.error('❌ Erro ao tentar match com atividades:', error);
        return { matchEncontrado: false, message: `Erro: ${error.message}` };
    }
}

/**
 * 🧪 TESTE: Endpoint para testar extração de base64 com competência específica
 */
router.post('/teste-extracao-base64', autenticarToken, async (req, res) => {
    try {
        const { clienteId, obrigacaoClienteId, competencia, tituloDocumento } = req.body;
        const empresaId = req.usuario?.empresaId;
        
        if (!empresaId || !clienteId || !obrigacaoClienteId || !competencia || !tituloDocumento) {
            return res.status(400).json({ 
                success: false, 
                message: "EmpresaId, clienteId, obrigacaoClienteId, competencia e tituloDocumento são obrigatórios" 
            });
        }
        
        // Buscar informações do cliente
        const [clienteInfo] = await db.query(`
            SELECT c.id, c.nome, c.cnpjCpf
            FROM clientes c
            WHERE c.id = ? AND c.empresaId = ?
        `, [clienteId, empresaId]);

        if (clienteInfo.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Cliente não encontrado ou não pertence à empresa"
            });
        }

        const cliente = clienteInfo[0];
        
        // Buscar credenciais da Onvio
        const credenciais = await obterCredenciaisOnvio(empresaId);
        if (!credenciais) {
            return res.status(400).json({
                success: false,
                message: "Credenciais da Onvio não configuradas para esta empresa"
            });
        }
        
        try {
            // Criar nova instância do OnvioService com o ID do usuário
            const { OnvioService } = require('../services/onvioService');
            const onvioService = new OnvioService(req.usuario.id);
            
            // Inicializar navegador
            await onvioService.initializeBrowser();
            
            // Fazer login usando email da empresa
            await onvioService.fazerLogin(credenciais, true, empresaId);
            
            // Buscar documentos com competência específica
            let documentos = await onvioService.buscarDocumentosEmpresa(
                cliente.cnpjCpf, 
                null, // 🚀 NOVA ESTRATÉGIA: NÃO passar competência específica, deixar buscar TODAS!
                tituloDocumento,
                null, // obrigacaoClienteId não disponível neste contexto
                empresaId, // 🎯 NOVO: Passar empresaId para automação
                cliente.id // 🎯 NOVO: Passar clienteId para busca otimizada
            );
            
            // 🎯 CORREÇÃO: Garantir que documentos seja sempre um array
            if (!documentos) {
                console.log(`⚠️ Documentos retornados como undefined/null, convertendo para array vazio`);
                documentos = [];
            } else if (!Array.isArray(documentos)) {
                console.log(`⚠️ Documentos retornados como objeto único, convertendo para array`);
                documentos = [documentos];
            }
            
            // Processar resultados
            const resultado = {
                success: true,
                message: "Teste de extração concluído",
                cliente: {
                    id: cliente.id,
                    nome: cliente.nome,
                    cnpjCpf: cliente.cnpjCpf
                },
                competencia: competencia,
                tituloDocumento: tituloDocumento,
                documentos: documentos,
                timestamp: new Date().toISOString()
            };

            // Verificar se algum documento foi extraído com base64
            const documentosComBase64 = documentos.filter(doc => doc.conteudoBase64);
            if (documentosComBase64.length > 0) {
                resultado.extracaoBase64 = {
                    sucesso: true,
                    quantidade: documentosComBase64.length,
                    tamanhos: documentosComBase64.map(doc => ({
                        titulo: doc.titulo,
                        tamanhoBase64: doc.conteudoBase64 ? doc.conteudoBase64.length : 0,
                        tipo: doc.tipo
                    }))
                };
                resultado.message = `✅ ${documentosComBase64.length} documento(s) extraído(s) com base64!`;
            } else {
                resultado.extracaoBase64 = {
                    sucesso: false,
                    mensagem: "Nenhum documento foi extraído com base64"
                };
                resultado.message = "⚠️ Documentos encontrados, mas sem extração de base64";
            }

            res.json(resultado);
            
        } finally {
            // Sempre fechar o navegador
            await onvioService.fecharNavegador();
        }
        
    } catch (error) {
        console.error('❌ Erro no teste de extração de base64:', error);
        
        // Fechar navegador em caso de erro
        try {
            await onvioService.fecharNavegador();
        } catch (e) {
            console.error('❌ Erro ao fechar navegador:', e);
        }
        
        res.status(500).json({
            success: false,
            message: `Erro no teste: ${error.message}`,
            error: error.message
        });
    }
});

/**
 * 🔍 Busca automática por CNPJ do cliente na Onvio
 */
router.post('/buscar-automatico-por-cnpj', autenticarToken, async (req, res) => {
    try {
        const { clienteId, obrigacaoClienteId, atividadeId, atividadeTexto } = req.body;
        const empresaId = req.usuario?.empresaId;
        
        if (!empresaId || !clienteId || !obrigacaoClienteId) {
            return res.status(400).json({ 
                success: false, 
                message: "EmpresaId, clienteId e obrigacaoClienteId são obrigatórios." 
            });
        }


        // Buscar a atividade de Integração Onvio clicada (se atividadeId fornecido, filtra por ele)
        // Junta pelo mesmo texto para garantir que pegamos o título_documento correto (Recibo vs Extrato)
        const params = [obrigacaoClienteId, empresaId];
        const filtroAtividade = atividadeId ? " AND oac.id = ?" : "";
        if (atividadeId) params.push(atividadeId);

        const [atividadeInfo] = await db.query(`
            SELECT 
                oac.id AS atividadeId,
                oac.texto AS atividadeTexto,
                ao.titulo_documento AS tituloDocumentoEsperado,
                ao.pdf_layout_id AS pdfLayoutId,
                o.id AS obrigacaoBaseId,
                o.nome AS obrigacaoNome,
                oc.id AS obrigacaoClienteId,
                c.id AS clienteId,
                c.nome AS clienteNome,
                c.cnpjCpf AS clienteCnpjCpf,
                oc.ano_referencia,
                oc.mes_referencia
            FROM obrigacoes_atividades_clientes oac
            JOIN obrigacoes_clientes oc ON oac.obrigacaoClienteId = oc.id
            JOIN obrigacoes o ON oc.obrigacaoId = o.id
            JOIN clientes c ON oc.clienteId = c.id
            LEFT JOIN atividades_obrigacao ao 
                ON ao.obrigacaoId = o.id 
                AND ao.tipo = oac.tipo 
                AND ao.texto = oac.texto
            WHERE oc.id = ? AND oac.tipo = 'Integração: Onvio' AND c.empresaId = ?${filtroAtividade}
        `, params);

        if (atividadeInfo.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: "Atividade 'Integração: Onvio' não encontrada para esta obrigação" 
            });
        }

        const info = atividadeInfo[0];

        // Fallback: se não encontrou tituloDocumentoEsperado na LEFT JOIN, usa o texto da atividade enviada
        if (!info.tituloDocumentoEsperado && atividadeTexto) {
            info.tituloDocumentoEsperado = atividadeTexto;
        }

        // Verificar se tem credenciais configuradas
        const credenciais = await obterCredenciaisOnvio(empresaId);
        if (!credenciais) {
            return res.status(400).json({
                success: false,
                message: "Credenciais da Onvio não configuradas para esta empresa"
            });
        }

        try {
            // Criar nova instância do OnvioService com o ID do usuário
            const { OnvioService } = require('../services/onvioService');
            const onvioService = new OnvioService(req.usuario.id);
            
            // Inicializar navegador
            await onvioService.initializeBrowser();
            
            // Fazer login usando email da empresa
            await onvioService.fazerLogin(credenciais, true, empresaId);
            
            // Formatar competência para busca
            let competencia = null;
            if (info.ano_referencia && info.mes_referencia) {
                competencia = `${String(info.mes_referencia).padStart(2, '0')}/${info.ano_referencia}`;
            }
            
            // Buscar documentos na Onvio
            let documentos = await onvioService.buscarDocumentosEmpresa(
                info.clienteCnpjCpf, 
                competencia, // Passar competência específica para filtrar
                info.tituloDocumentoEsperado,
                obrigacaoClienteId, // Passar obrigacaoClienteId para automação
                empresaId,
                info.clienteId, // 🎯 NOVO: Passar clienteId para busca otimizada
                info.atividadeId // 🎯 NOVO: Passar atividadeId específica
            );
            
            // Garantir que documentos seja sempre um array
            if (!documentos) {
                documentos = [];
            } else if (!Array.isArray(documentos)) {
                documentos = [documentos];
            }

            console.log(`📄 Encontrados ${documentos.length} documentos na Onvio`);

            if (documentos.length === 0) {
                return res.json({
                    success: false,
                    message: "Nenhum documento válido encontrado na Onvio"
                });
            }

            // Tentar fazer match com o primeiro documento encontrado
            const documentoEncontrado = documentos[0];
            console.log(`🎯 Tentando fazer match com documento: ${documentoEncontrado.nome || documentoEncontrado.titulo}`);

            // Clicar no documento para abrir e extrair informações
            try {
                if (documentoEncontrado.elemento && typeof documentoEncontrado.elemento.click === 'function') {
                    await documentoEncontrado.elemento.click();
                    console.log(`✅ Documento clicado com sucesso: ${documentoEncontrado.nome || documentoEncontrado.titulo}`);
                    
                    // Aguardar carregamento do documento
                    await new Promise(resolve => setTimeout(resolve, 2000));
                } else {
                    console.log(`⚠️ Elemento do documento não encontrado ou não clicável`);
                }
            } catch (error) {
                console.log(`⚠️ Erro ao clicar no documento: ${error.message}`);
            }

            const resultadoMatch = await onvioService.fazerMatchEAutomatizarAtividade(
                documentoEncontrado, 
                obrigacaoClienteId, 
                empresaId,
                info.atividadeId // Passar o ID específico da atividade clicada
            );

            if (resultadoMatch.sucesso) {
                return res.json({
                    success: true,
                    message: "Documento encontrado e atividade concluída com sucesso!",
                    detalhes: {
                        cliente: info.clienteNome,
                        documento: documentoEncontrado.nome || documentoEncontrado.titulo,
                        atividadeId: resultadoMatch.atividadeId
                    }
                });
            } else {
                // Se a atividade já foi concluída na primeira tentativa, retornar sucesso
                if (resultadoMatch.erro && resultadoMatch.erro.includes('Nenhuma atividade de integração encontrada')) {
                    return res.json({
                        success: true,
                        message: "Documento encontrado e atividade já foi concluída!",
                        detalhes: {
                            cliente: info.clienteNome,
                            documento: documentoEncontrado.nome || documentoEncontrado.titulo,
                            atividadeJaConcluida: true
                        }
                    });
                }
                
                return res.json({
                    success: false,
                    message: resultadoMatch.erro || "Erro ao processar documento encontrado"
                });
            }

        } finally {
            // Sempre fechar o navegador
            await onvioService.fecharNavegador();
        }
        
    } catch (error) {
        console.error('❌ Erro na busca automática Onvio:', error);
        
        // Fechar navegador em caso de erro
        try {
            await onvioService.fecharNavegador();
        } catch (e) {
            console.error('❌ Erro ao fechar navegador:', e);
        }
        
        res.status(500).json({
            success: false,
            message: `Erro na busca automática: ${error.message}`,
            error: error.message
        });
    }
});

// Função auxiliar para processar a baixa de um documento
async function processarBaixaDocumento(docAtual, atividade, cliente, competencia, page, forcar = false, onvioService = null) {
    try {
        // Garantir que abriu o documento: tentar link interno /document/ e duplo clique com retries até URL conter /document/
        try {
            const linkInterno = await page.$('a[href*="/document/"]');
            if (linkInterno) {
                try { await linkInterno.click(); } catch(_) {}
                await new Promise(r => setTimeout(r, 400));
            }
            for (let i = 0; i < 8; i++) {
                const atual = await page.url();
                if (/\/document\//i.test(atual)) break;
                try {
                    if (docAtual.elemento && typeof docAtual.elemento.click === 'function') {
                        await docAtual.elemento.click({ clickCount: 2, delay: 20 });
                    }
                } catch(_) {}
                await new Promise(r => setTimeout(r, 500));
            }
        } catch(_) {}

        // Após clicar, capturar a URL atual do navegador
        const urlAtual = await page.url();
        // Pega o link do documento (usando onvioService se disponível)
        let infoArquivo = null;
        if (onvioService && typeof onvioService.extrairInfoArquivo === 'function') {
            infoArquivo = await onvioService.extrairInfoArquivo();
        }
        // Usa a URL do navegador como link principal, mas exige /document/
        const linkPreferencial = infoArquivo?.url || infoArquivo?.linkDocumento || infoArquivo?.href || urlAtual || null;
        const linkDocumento = /\/document\//i.test(linkPreferencial || '') ? linkPreferencial : null;
        // Marca a atividade como concluída (update direto no banco)
        await db.query(
            'UPDATE obrigacoes_atividades_clientes SET concluida = 1, dataConclusao = CONVERT_TZ(NOW(), \'+00:00\', \'-09:00\') WHERE id = ?',
            [atividade.id]
        );
      
        // Salva o link do documento nos comentários da obrigação
        const comentario = `Documento encontrado automaticamente via integração Onvio: ${docAtual.titulo || docAtual.nome}\n\nLink: ${linkDocumento || '(não confirmou /document/)'}\n\nData da busca: ${new Date().toLocaleString('pt-BR')}`;
        await db.query(`
            INSERT INTO comentarios_obrigacao (obrigacaoId, usuarioId, comentario, tipo, criadoEm)
            VALUES (?, ?, ?, ?, CONVERT_TZ(NOW(), '+00:00', '-09:00'))
        `, [atividade.obrigacaoClienteId, 1, comentario, 'usuario']);
        console.log(`[${cliente.nome}] ${forcar ? '[FORÇADO]' : ''} Baixa realizada e atividade ${atividade.id} marcada como concluída para documento: ${docAtual.titulo || docAtual.nome}`);
        // Adicione ao array de resultados, se necessário
        return {
            arquivo: docAtual.titulo || docAtual.nome,
            link: linkDocumento,
            carregamentoForcado: forcar,
            sucesso: true
        };
    } catch (erro) {
        console.log(`[${cliente.nome}] Erro ao processar baixa do documento: ${docAtual.titulo || docAtual.nome}`, erro);
        return {
            arquivo: docAtual.titulo || docAtual.nome,
            erro: erro.message || erro,
            carregamentoForcado: forcar,
            sucesso: false
        };
    }
}

module.exports = router;