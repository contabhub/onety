const express = require("express");
const axios = require("axios");
const { 
    obterTodasEmpresas, 
    obterCertidaoNegativa, 
    importarEmpresasParaBD,
    consultarDocumentosAlterdata,
    testarConexaoAlterdata,
    buscarDocumentosCliente,
    analisarEstruturaDocumentos,
    listarEmpresasAlterdata,
    buscarDocumentosTodasEmpresas,
    buscarCategoriasDocumentos,
    obterConteudoDocumento,
    obterTokenEplugin
} = require("../../services/gestao/epluginService");
const clienteController = require("../../controllers/gestao/clienteController");
const db = require("../../config/database"); // Importar conexão com BD

const API_DOCUMENTOS_BASE_URL = "https://documentos.pack.alterdata.com.br/api/v1";

const router = express.Router();

/**
 * 📌 Rota para obter a Certidão Negativa de Débito (CND) de uma empresa
 */
router.get("/certidao/:empresaId", async (req, res) => {
    console.log(`🔍 Requisição recebida para buscar CND da empresa ID: ${req.params.empresaId}`);

    try {
        const { empresaId } = req.params;

        // Verificação básica do ID da empresa
        if (!empresaId || isNaN(empresaId)) {
            console.warn("⚠️ ID da empresa inválido:", empresaId);
            return res.status(400).json({ error: "O ID da empresa deve ser um número válido." });
        }

        const certidoes = await obterCertidaoNegativa(empresaId);
        console.log(`✅ CNDs da empresa ${empresaId} obtidas com sucesso.`);
        res.json(certidoes);
    } catch (error) {
        console.error(`❌ Erro ao obter CND da empresa ${req.params.empresaId}:`, error);
        res.status(500).json({ error: error.message || "Erro desconhecido ao obter CND." });
    }
});

/**
 * 📌 Rota para testar conexão com a API do Alterdata
 * GET /api/eplugin/testar-conexao-alterdata?empresaId=123
 */
router.get("/testar-conexao-alterdata", async (req, res) => {
    try {
        const empresaId = req.query.empresaId;
        
        if (!empresaId) {
            return res.status(400).json({ error: "Empresa ID é obrigatório." });
        }

        console.log("🧪 Iniciando teste de conexão com Alterdata para empresa:", empresaId);
        
        const resultado = await testarConexaoAlterdata(empresaId);
        
        if (resultado.success) {
            res.json({
                success: true,
                message: resultado.message,
                data: resultado.data
            });
        } else {
            res.status(500).json({
                success: false,
                message: resultado.message,
                error: resultado.error
            });
        }
    } catch (error) {
        console.error("❌ Erro no teste de conexão:", error);
        res.status(500).json({ 
            success: false, 
            message: "Erro interno no teste de conexão",
            error: error.message 
        });
    }
});

/**
 * 📌 Rota para consultar documentos do Alterdata
 * GET /api/eplugin/documentos-alterdata?empresaId=123&pago=true&sort=-criacao&page[limit]=10
 */
router.get("/documentos-alterdata", async (req, res) => {
    try {
        const empresaId = req.query.empresaId;
        
        if (!empresaId) {
            return res.status(400).json({ error: "Empresa ID é obrigatório." });
        }

        // Extrair filtros da query
        const filtros = {
            pago: req.query.pago,
            criacao: req.query.criacao,
            vencimento: req.query.vencimento,
            expiracao: req.query.expiracao,
            pagamento: req.query.pagamento,
            include: req.query.include,
            sort: req.query.sort,
            pageOffset: req.query['page[offset]'],
            pageLimit: req.query['page[limit]']
        };

        console.log(`🔍 Consultando documentos do Alterdata para empresa: ${empresaId}`);
        
        const documentos = await consultarDocumentosAlterdata(empresaId, filtros);
        
        res.json({
            success: true,
            data: documentos
        });
    } catch (error) {
        console.error("❌ Erro ao consultar documentos:", error);
        res.status(500).json({ 
            success: false, 
            message: "Erro ao consultar documentos do Alterdata",
            error: error.message 
        });
    }
});

/**
 * 📌 Rota para buscar documentos de um cliente específico
 * GET /api/eplugin/clientes/:clienteId/documentos-alterdata?empresaId=123
 */
router.get("/clientes/:clienteId/documentos-alterdata", async (req, res) => {
    try {
        const { clienteId } = req.params;
        const empresaId = req.query.empresaId;
        
        if (!clienteId) {
            return res.status(400).json({ error: "Cliente ID é obrigatório." });
        }

        if (!empresaId) {
            return res.status(400).json({ error: "Empresa ID é obrigatório." });
        }

        console.log(`🔍 Buscando documentos do cliente ${clienteId} na empresa ${empresaId}`);
        
        const documentos = await buscarDocumentosCliente(empresaId, clienteId, req.query);
        
        res.json({
            success: true,
            data: documentos
        });
    } catch (error) {
        console.error("❌ Erro ao buscar documentos do cliente:", error);
        res.status(500).json({ 
            success: false, 
            message: "Erro ao buscar documentos do cliente",
            error: error.message 
        });
    }
});

/**
 * 📌 Rota para analisar estrutura dos dados
 * GET /api/eplugin/teste-estrutura-alterdata?empresaId=123
 */
router.get("/teste-estrutura-alterdata", async (req, res) => {
    try {
        const empresaId = req.query.empresaId;
        
        if (!empresaId) {
            return res.status(400).json({ error: "Empresa ID é obrigatório." });
        }

        console.log("🧪 Testando estrutura de dados do Alterdata para empresa:", empresaId);
        
        const analise = await analisarEstruturaDocumentos(empresaId);
        
        res.json({
            success: true,
            analise: analise
        });
    } catch (error) {
        console.error("❌ Erro ao analisar estrutura:", error);
        res.status(500).json({ 
            success: false, 
            message: "Erro ao analisar estrutura dos dados",
            error: error.message 
        });
    }
});

/**
 * 📌 Rota para listar empresas disponíveis no Alterdata
 * GET /api/eplugin/empresas-alterdata?empresaId=123
 */
router.get("/empresas-alterdata", async (req, res) => {
    try {
        const empresaId = req.query.empresaId;
        
        if (!empresaId) {
            return res.status(400).json({ error: "Empresa ID é obrigatório." });
        }

        console.log("🔍 Listando empresas disponíveis no Alterdata para empresa:", empresaId);
        
        const empresas = await listarEmpresasAlterdata(empresaId);
        
        res.json({
            success: true,
            data: empresas
        });
    } catch (error) {
        console.error("❌ Erro ao listar empresas do Alterdata:", error);
        res.status(500).json({ 
            success: false, 
            message: "Erro ao listar empresas do Alterdata",
            error: error.message 
        });
    }
});

/**
 * 📌 Rota para buscar documentos de todas as empresas
 * GET /api/eplugin/documentos-todas-empresas?empresaId=123
 */
router.get("/documentos-todas-empresas", async (req, res) => {
    try {
        const empresaId = req.query.empresaId;
        
        if (!empresaId) {
            return res.status(400).json({ error: "Empresa ID é obrigatório." });
        }

        console.log("🔍 Buscando documentos de todas as empresas para empresa:", empresaId);
        
        const resultado = await buscarDocumentosTodasEmpresas(empresaId);
        
        res.json({
            success: true,
            data: resultado
        });
    } catch (error) {
        console.error("❌ Erro ao buscar documentos de todas as empresas:", error);
        res.status(500).json({ 
            success: false, 
            message: "Erro ao buscar documentos de todas as empresas",
            error: error.message 
        });
    }
});

/**
 * 📌 Rota para buscar categorias de documentos
 * GET /api/eplugin/categorias-documentos?empresaId=123
 */
router.get("/categorias-documentos", async (req, res) => {
    try {
        const empresaId = req.query.empresaId;
        
        if (!empresaId) {
            return res.status(400).json({ error: "Empresa ID é obrigatório." });
        }

        console.log("📁 Buscando categorias de documentos para empresa:", empresaId);
        
        const resultado = await buscarCategoriasDocumentos(empresaId);
        
        res.json({
            success: true,
            data: resultado
        });
    } catch (error) {
        console.error("❌ Erro ao buscar categorias:", error);
        res.status(500).json({ 
            success: false, 
            message: "Erro ao buscar categorias de documentos",
            error: error.message 
        });
    }
});

/**
 * 📌 Rota para obter conteúdo/base64 de um documento específico
 * GET /api/eplugin/documento/:documentoId/conteudo?empresaId=123
 */
router.get("/documento/:documentoId/conteudo", async (req, res) => {
    try {
        const { documentoId } = req.params;
        const empresaId = req.query.empresaId;
        
        if (!documentoId) {
            return res.status(400).json({ error: "Documento ID é obrigatório." });
        }

        if (!empresaId) {
            return res.status(400).json({ error: "Empresa ID é obrigatório." });
        }

        console.log(`📄 Obtendo conteúdo do documento ${documentoId} para empresa ${empresaId}`);
        
        const token = await obterTokenEplugin(empresaId);
        if (!token) {
            return res.status(500).json({ error: "❌ Nenhum token válido do Eplugin encontrado." });
        }

        // Buscar TODOS os CNPJs dos clientes na empresa
        const [clientesResult] = await db.query(
            "SELECT cnpjCpf FROM clientes WHERE empresaId = ?",
            [empresaId]
        );

        if (!clientesResult.length) {
            return res.status(404).json({ error: "❌ Nenhum cliente encontrado para esta empresa." });
        }

        console.log(`    📋 Total de clientes encontrados: ${clientesResult.length}`);
        
        const resultados = [];
        
        // Testar com cada CNPJ
        for (let i = 0; i < clientesResult.length; i++) {
            const cnpjCliente = clientesResult[i].cnpjCpf;
            console.log(`\n    🔍 Testando cliente ${i + 1}/${clientesResult.length}: ${cnpjCliente}`);
            
            // Limpar o CNPJ (remover caracteres não numéricos)
            const cnpjLimpo = cnpjCliente.replace(/\D/g, '');
            console.log(`    🧹 CNPJ limpo: ${cnpjLimpo}`);
            
            try {
                // Tentar obter conteúdo do documento com este CNPJ
                const resultado = await obterConteudoDocumento(documentoId, empresaId, cnpjLimpo);
                
                if (resultado.success) {
                    console.log(`    ✅ Sucesso! Conteúdo obtido via CNPJ ${cnpjLimpo}`);
                    
                    resultados.push({
                        cnpj: cnpjCliente,
                        cnpjLimpo: cnpjLimpo,
                        success: true,
                        data: resultado
                    });
                    
                    // Retornar o primeiro sucesso encontrado
                    return res.json({
                        success: true,
                        data: {
                            cnpjUsado: cnpjCliente,
                            cnpjLimpoUsado: cnpjLimpo,
                            resultado: resultado
                        }
                    });
                    
                } else {
                    console.log(`    ❌ Falha com CNPJ ${cnpjLimpo}: ${resultado.message}`);
                    
                    resultados.push({
                        cnpj: cnpjCliente,
                        cnpjLimpo: cnpjLimpo,
                        success: false,
                        error: resultado.message
                    });
                }
                
            } catch (error) {
                console.log(`    ❌ Erro com CNPJ ${cnpjLimpo}: ${error.message}`);
                
                resultados.push({
                    cnpj: cnpjCliente,
                    cnpjLimpo: cnpjLimpo,
                    success: false,
                    error: error.message
                });
            }
        }
        
        // Se chegou aqui, nenhum CNPJ funcionou
        const sucessos = resultados.filter(r => r.success).length;
        const falhas = resultados.filter(r => !r.success).length;
        
        console.log(`\n    🏁 RESUMO:`);
        console.log(`    ✅ Sucessos: ${sucessos}/${clientesResult.length}`);
        console.log(`    ❌ Falhas: ${falhas}/${clientesResult.length}`);
        
        res.status(404).json({
            success: false,
            message: "Nenhum CNPJ conseguiu obter o conteúdo do documento",
            data: {
                totalClientes: clientesResult.length,
                sucessos: sucessos,
                falhas: falhas,
                resultados: resultados
            }
        });
        
    } catch (error) {
        console.error("❌ Erro ao obter conteúdo do documento:", error);
        res.status(500).json({ 
            success: false, 
            message: "Erro ao obter conteúdo do documento",
            error: error.message 
        });
    }
});

/**
 * 📌 Rota para testar relacionamentos de um documento específico
 * GET /api/eplugin/documento/:documentoId/relacionamentos?empresaId=123
 */
router.get("/documento/:documentoId/relacionamentos", async (req, res) => {
    try {
        const { documentoId } = req.params;
        const empresaId = req.query.empresaId;
        
        if (!documentoId) {
            return res.status(400).json({ error: "Documento ID é obrigatório." });
        }

        if (!empresaId) {
            return res.status(400).json({ error: "Empresa ID é obrigatório." });
        }

        console.log(`🔍 Testando relacionamentos do documento ${documentoId} para empresa ${empresaId}`);
        
        const token = await obterTokenEplugin(empresaId);
        if (!token) {
            return res.status(500).json({ error: "❌ Nenhum token válido do Eplugin encontrado." });
        }

        // Buscar TODOS os CNPJs dos clientes na empresa
        const [clientesResult] = await db.query(
            "SELECT cnpjCpf FROM clientes WHERE empresaId = ?",
            [empresaId]
        );

        if (!clientesResult.length) {
            return res.status(404).json({ error: "❌ Nenhum cliente encontrado para esta empresa." });
        }

        console.log(`    📋 Total de clientes encontrados: ${clientesResult.length}`);
        
        const resultados = [];
        
        // Testar com cada CNPJ
        for (let i = 0; i < clientesResult.length; i++) {
            const cnpjCliente = clientesResult[i].cnpjCpf;
            console.log(`\n    🔍 Testando cliente ${i + 1}/${clientesResult.length}: ${cnpjCliente}`);
            
            // Limpar o CNPJ (remover caracteres não numéricos)
            const cnpjLimpo = cnpjCliente.replace(/\D/g, '');
            console.log(`    🧹 CNPJ limpo: ${cnpjLimpo}`);

                         try {
                 // Tentar buscar o documento com este CNPJ
                 const response = await axios.get(`${API_DOCUMENTOS_BASE_URL}/integracao/documentos/${documentoId}`, {
                     headers: {
                         "Authorization": `Bearer ${token}`,
                         "Content-Type": "application/json"
                     }
                 });

                 const documento = response.data?.data;
                 
                 console.log(`    ✅ Sucesso! Documento encontrado`);
                 
                 resultados.push({
                     cnpj: cnpjCliente,
                     cnpjLimpo: cnpjLimpo,
                     success: true,
                     documento: documento,
                     relationships: documento?.relationships || {},
                     links: documento?.relationships?.arquivos?.links || {},
                     includes: response.data?.included || []
                 });
                 
             } catch (error) {
                 console.log(`    ❌ Erro: ${error.response?.status} - ${error.response?.statusText || error.message}`);
                 
                 resultados.push({
                     cnpj: cnpjCliente,
                     cnpjLimpo: cnpjLimpo,
                     success: false,
                     error: error.response?.statusText || error.message,
                     status: error.response?.status
                 });
             }
         }
         
         const sucessos = resultados.filter(r => r.success).length;
         const falhas = resultados.filter(r => !r.success).length;
         
         console.log(`\n    🏁 RESUMO:`);
         console.log(`    ✅ Sucessos: ${sucessos}/${clientesResult.length}`);
         console.log(`    ❌ Falhas: ${falhas}/${clientesResult.length}`);
         
         // Retornar o primeiro resultado com sucesso, ou todos os resultados
         const primeiroSucesso = resultados.find(r => r.success);
         
         res.json({
             success: true,
             data: {
                 totalClientes: clientesResult.length,
                 sucessos: sucessos,
                 falhas: falhas,
                 primeiroSucesso: primeiroSucesso || null,
                 todosResultados: resultados
             }
         });
    } catch (error) {
        console.error("❌ Erro ao testar relacionamentos:", error);
        res.status(500).json({ 
            success: false, 
            message: "Erro ao testar relacionamentos do documento",
            error: error.message 
        });
    }
});

/**
 * 📌 Rota para testar acesso a documentos da empresa
 * GET /api/eplugin/testar-documentos-empresa?empresaId=123
 */
router.get("/testar-documentos-empresa", async (req, res) => {
    try {
        const empresaId = req.query.empresaId;
        
        if (!empresaId) {
            return res.status(400).json({ error: "Empresa ID é obrigatório." });
        }

        console.log(`🔍 Testando acesso a documentos da empresa ${empresaId}`);
        
        const token = await obterTokenEplugin(empresaId);
        if (!token) {
            return res.status(500).json({ error: "❌ Nenhum token válido do Eplugin encontrado." });
        }

        // Buscar TODOS os CNPJs dos clientes na empresa
        const [clientesResult] = await db.query(
            "SELECT cnpjCpf FROM clientes WHERE empresaId = ?",
            [empresaId]
        );

        if (!clientesResult.length) {
            return res.status(404).json({ error: "❌ Nenhum cliente encontrado para esta empresa." });
        }

        console.log(`    📋 Total de clientes encontrados: ${clientesResult.length}`);
        
        const resultados = [];
        
        // Testar com cada CNPJ
        for (let i = 0; i < clientesResult.length; i++) {
            const cnpjCliente = clientesResult[i].cnpjCpf;
            console.log(`\n    🔍 Testando cliente ${i + 1}/${clientesResult.length}: ${cnpjCliente}`);
            
            // Limpar o CNPJ (remover caracteres não numéricos)
            const cnpjLimpo = cnpjCliente.replace(/\D/g, '');
            console.log(`    🧹 CNPJ limpo: ${cnpjLimpo}`);
            
                         try {
                 // Tentar buscar documentos com este CNPJ
                 const response = await axios.get(`${API_DOCUMENTOS_BASE_URL}/integracao/documentos?filter[empresaId]=${cnpjLimpo}&page[limit]=5`, {
                     headers: {
                         "Authorization": `Bearer ${token}`,
                         "Content-Type": "application/json"
                     }
                 });

                 const documentos = response.data?.data || [];
                 
                 console.log(`    ✅ Sucesso! ${documentos.length} documentos encontrados`);
                 
                 resultados.push({
                     cnpj: cnpjCliente,
                     cnpjLimpo: cnpjLimpo,
                     success: true,
                     totalDocumentos: documentos.length,
                     documentos: documentos
                 });
                 
             } catch (error) {
                 console.log(`    ❌ Erro: ${error.response?.status} - ${error.response?.statusText || error.message}`);
                 
                 resultados.push({
                     cnpj: cnpjCliente,
                     cnpjLimpo: cnpjLimpo,
                     success: false,
                     error: error.response?.statusText || error.message,
                     status: error.response?.status
                 });
             }
         }
         
         const sucessos = resultados.filter(r => r.success).length;
         const falhas = resultados.filter(r => !r.success).length;
         const totalDocumentos = resultados.reduce((sum, r) => sum + (r.totalDocumentos || 0), 0);
         
         console.log(`\n    🏁 RESUMO:`);
         console.log(`    ✅ Sucessos: ${sucessos}/${clientesResult.length}`);
         console.log(`    ❌ Falhas: ${falhas}/${clientesResult.length}`);
         console.log(`    📄 Total de documentos: ${totalDocumentos}`);
         
         res.json({
             success: true,
             data: {
                 totalClientes: clientesResult.length,
                 sucessos: sucessos,
                 falhas: falhas,
                 totalDocumentos: totalDocumentos,
                 resultados: resultados
             }
         });
    } catch (error) {
        console.error("❌ Erro ao testar documentos da empresa:", error);
        res.status(500).json({ 
            success: false, 
            message: "Erro ao testar documentos da empresa",
            error: error.message 
        });
    }
});



module.exports = router;
