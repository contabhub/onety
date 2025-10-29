const axios = require("axios");
const db = require("../../config/database"); // ✅ Adicionando a importação correta do banco de dados

const API_BASE_URL = "https://dp.pack.alterdata.com.br/api/v1";
const API_CND_BASE_URL = "https://cnd.pack.alterdata.com.br/api/v1/integracao/certidoes";
const API_DOCUMENTOS_BASE_URL = "https://documentos.pack.alterdata.com.br/api/v1";
const EPLUGIN_TOKEN = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzUxMiJ9.eyJ1YyI6IjI5ODAwIiwiaXNzIjoicGFja3VwIiwiZGF0YSI6IjIwMjUtMDEtMTRUMTU6NTk6MTUuNDMwMjg4LTAzOjAwIn0.qZ9BEOktHlBkw3MYooigPHRID7T9T5Wh-80rnUBEdecaKpEhq0g6yAlHTdxuHOs19jdCOcsSv2vlCHXz2P4R2Q"; // Substitua pelo token correto


/**
 * 📌 Obtém o token do Eplugin para a empresa específica
 */
async function obterTokenEplugin(empresaId) {
    console.log(`🔍 Buscando token do Eplugin para empresa ID: ${empresaId}`);

    try {
        const [result] = await db.query(
            "SELECT apiKeyEplugin FROM empresas WHERE id = ?",
            [empresaId]
        );

        if (!result.length || !result[0].apiKeyEplugin) {
            console.warn("❌ Nenhum token do Eplugin encontrado para esta empresa.");
            throw new Error("❌ Nenhum token do Eplugin encontrado para esta empresa.");
        }

        console.log("✅ Token do Eplugin obtido com sucesso!");
        return result[0].apiKeyEplugin;
    } catch (error) {
        console.error("❌ Erro ao buscar token do Eplugin:", error);
        throw new Error("Erro ao buscar token do Eplugin.");
    }
}


/**
 * 📌 Função para buscar todas as empresas paginadas do Eplugin
 */
async function obterTodasEmpresas(empresaId) {
    console.log(`🔍 Obtendo empresas do Eplugin para empresa ID: ${empresaId}`);

    try {
        const token = await obterTokenEplugin(empresaId);

        if (!token) {
            throw new Error("❌ Nenhum token válido do Eplugin encontrado.");
        }

        let todasEmpresas = [];
        let offset = 0;
        const limit = 25;
        let continuar = true;

        while (continuar) {
            try {
                const response = await axios.get(`${API_BASE_URL}/empresas`, {
                    headers: {
                        "Authorization": `Bearer ${token}`,
                        "Content-Type": "application/json"
                    },
                    params: {
                        "page[offset]": offset,
                        "page[limit]": limit
                    }
                });

                const empresas = response.data?.data || [];
                todasEmpresas.push(...empresas);

                if (empresas.length < limit) {
                    continuar = false;
                } else {
                    offset += limit;
                }
            } catch (error) {
                console.error("❌ Erro ao obter empresas:", error.response?.data || error.message);
                break;
            }
        }

        console.log(`✅ Total de empresas obtidas: ${todasEmpresas.length}`);
        return todasEmpresas;

    } catch (error) {
        console.error("❌ Erro ao obter empresas do Eplugin:", error);
        throw new Error("Erro ao buscar empresas do Eplugin.");
    }
}


/**
 * 📌 Função para importar empresas do Eplugin para o banco de dados
 */
/**
 * 📌 Função para importar empresas do Eplugin para o banco de dados
 */
async function importarEmpresasParaBD(empresaId, usuarioId) {
    console.log(`🚀 Iniciando importação de empresas para empresa ID: ${empresaId}, Usuário ID: ${usuarioId}`);

    try {
        // Obtém todas as empresas
        const empresas = await obterTodasEmpresas(empresaId);

        for (const empresa of empresas) {
            const { cpfcnpj, nome, endereco, externoid } = empresa.attributes;

            // Verifica se o cliente já existe no banco de dados (considerando a combinação de cnpjCpf e empresaId)
            const [clienteExistente] = await db.query(
                "SELECT id FROM clientes WHERE cnpjCpf = ? AND empresaId = ?",
                [cpfcnpj, empresaId]
            );

            let clienteId;

            if (!clienteExistente.length) {
                // Caso o cliente não exista, cria um novo cliente na tabela `clientes`
                const [result] = await db.query(
                    "INSERT INTO clientes (empresaId, cnpjCpf, nome, telefone, email, endereco, dataCriacao) VALUES (?, ?, ?, ?, ?, ?, NOW())",
                    [empresaId, cpfcnpj, nome, externoid || null, "" || null, endereco || null]
                );

                clienteId = result.insertId;
                console.log(`✅ Cliente inserido: ${nome} - ID ${clienteId}`);
            } else {
                clienteId = clienteExistente[0].id;
                console.log(`⚠ Cliente já existente: ${nome} - ID ${clienteId}`);
            }

            // **Aqui estamos criando a relação empresa-cliente na tabela `clientes`, usando empresaId e clienteId**
            const [relacaoExistente] = await db.query(
                "SELECT id FROM clientes WHERE empresaId = ? AND id = ?",
                [empresaId, clienteId]
            );

            if (!relacaoExistente.length) {
                // Adiciona a relação empresa-cliente diretamente na tabela `clientes`
                await db.query(
                    "INSERT INTO clientes (empresaId, clienteId, usuarioId) VALUES (?, ?, ?)",
                    [empresaId, clienteId, usuarioId]
                );

                console.log(`✅ Associação criada para ${nome} (Empresa ID: ${empresaId})`);
            } else {
                console.log(`⚠ Associação já existente para ${nome} (Empresa ID: ${empresaId})`);
            }
        }

        console.log(`✅ Importação finalizada. Total de empresas processadas: ${empresas.length}`);
    } catch (error) {
        console.error("❌ Erro ao importar empresas para o banco:", error);
    }
}

/**
 * 📌 Função para buscar a Certidão Negativa de Débito (CND) de uma empresa específica
 */
async function obterCertidaoNegativa(empresaId) {
    try {
        const response = await axios.get(API_CND_BASE_URL, {
            headers: {
                "Authorization": `Bearer ${EPLUGIN_TOKEN}`,
                "Content-Type": "application/json"
            },
            params: {
                "filter[empresaId]": empresaId,  // Filtrar pela empresa
                "filter[ultimasemissoes]": true,  // Retornar apenas as últimas emissões
                "include": "tipoCertidao,status", // Incluir tipo de certidão e status
                "fields": "emissao,vencimento,status,nomeOrgaoEmissor", // Campos úteis
                "sort": "-emissao", // Ordenar da mais recente para a mais antiga
                "page[offset]": 0, // Página inicial
                "page[limit]": 10  // Retornar até 10 resultados
            }
        });

        console.log(`✅ CNDs da empresa ${empresaId} obtidas com sucesso:`, response.data);
        return response.data;
    } catch (error) {
        console.error(`❌ Erro ao obter CNDs da empresa ${empresaId}:`, error.response?.data || error.message);
        throw new Error(error.response?.data?.mensagem || "Falha ao obter CNDs");
    }
}


/**
 * 📌 Função para consultar documentos do Alterdata
 * Baseado na documentação: https://eplugin.pack.alterdata.com.br/#documentos-consulta-de-documentos-get
 */
async function consultarDocumentosAlterdata(empresaId, filtros = {}, tokenFornecido = null) {
    try {
        let token;
        
        if (tokenFornecido) {
            token = tokenFornecido;
        } else {
            token = await obterTokenEplugin(empresaId);
            if (!token) {
                throw new Error("❌ Nenhum token válido do Eplugin encontrado.");
            }
        }

        // Construir URL com parâmetros
        const url = new URL(`${API_DOCUMENTOS_BASE_URL}/integracao/documentos`);
        
        // Adicionar filtro obrigatório de empresaId (que é o CNPJ)
        if (empresaId) {
            // Remover caracteres não numéricos do CNPJ
            const cnpjLimpo = empresaId.toString().replace(/\D/g, '');
            url.searchParams.append('filter[empresaId]', cnpjLimpo);
        }
        
        // Adicionar filtros opcionais
        if (filtros.pago !== undefined) {
            url.searchParams.append('filter[pago]', filtros.pago);
        }
        if (filtros.criacao) {
            url.searchParams.append('filter[criacao]', filtros.criacao);
        }
        if (filtros.vencimento) {
            url.searchParams.append('filter[vencimento]', filtros.vencimento);
        }
        if (filtros.expiracao) {
            url.searchParams.append('filter[expiracao]', filtros.expiracao);
        }
        if (filtros.pagamento) {
            url.searchParams.append('filter[pagamento]', filtros.pagamento);
        }
        // Adicionar parâmetros de paginação e ordenação
        if (filtros.include) {
            url.searchParams.append('include', filtros.include);
        }
        if (filtros.sort) {
            url.searchParams.append('sort', filtros.sort);
        }
        if (filtros.pageOffset !== undefined) {
            url.searchParams.append('page[offset]', filtros.pageOffset);
        }
        if (filtros.pageLimit) {
            url.searchParams.append('page[limit]', filtros.pageLimit);
        }
        if (filtros['page[limit]']) {
            url.searchParams.append('page[limit]', filtros['page[limit]']);
        }

        console.log(`    🔗 URL construída: ${url.toString()}`);
        console.log(`    📋 CNPJ usado: ${empresaId ? empresaId.toString().replace(/\D/g, '') : 'N/A'}`);
        console.log(`    🔑 Token usado: ${token ? token.substring(0, 20) + '...' : 'N/A'}`);
        
        const response = await axios.get(url.toString(), {
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            }
        });

        return response.data;

    } catch (error) {
        console.error("❌ Erro detalhado na consulta ao Alterdata:");
        console.error(`    CNPJ (empresaId): ${empresaId}`);
        console.error(`    CNPJ limpo: ${empresaId ? empresaId.toString().replace(/\D/g, '') : 'N/A'}`);
        console.error(`    Filtros: ${JSON.stringify(filtros, null, 2)}`);
        console.error(`    Status: ${error.response?.status}`);
        console.error(`    Status Text: ${error.response?.statusText}`);
        console.error(`    Data: ${JSON.stringify(error.response?.data, null, 2)}`);
        console.error(`    Headers: ${JSON.stringify(error.response?.headers, null, 2)}`);
        console.error(`    Message: ${error.message}`);
        console.error(`    Code: ${error.code}`);
        
        let errorMessage = "Erro ao consultar documentos do Alterdata";
        
        if (error.response?.status === 403) {
            errorMessage = "Acesso negado - verifique o token de autenticação";
        } else if (error.response?.status === 404) {
            errorMessage = "Recurso não encontrado - verifique os parâmetros da consulta";
        } else if (error.response?.status === 500) {
            errorMessage = "Erro interno do servidor Alterdata - tente novamente mais tarde";
        } else if (error.response?.status === 401) {
            errorMessage = "Token inválido ou expirado";
        } else if (error.code === 'ECONNREFUSED') {
            errorMessage = "Servidor Alterdata inacessível";
        } else if (error.code === 'ENOTFOUND') {
            errorMessage = "Domínio Alterdata não encontrado";
        } else if (error.code === 'ETIMEDOUT') {
            errorMessage = "Timeout na conexão com Alterdata";
        }
        
        throw new Error(`${errorMessage}: ${error.response?.statusText || error.message}`);
    }
}

/**
 * 📌 Função para testar conexão com a API do Alterdata
 */
async function testarConexaoAlterdata(empresaId) {
    console.log(`🧪 Testando conexão com Alterdata para empresa ID: ${empresaId}`);

    try {
        const resultado = await consultarDocumentosAlterdata(empresaId, {
            'page[limit]': 1,
            sort: '-criacao'
        });

        console.log("✅ Conexão com Alterdata testada com sucesso!");
        return {
            success: true,
            message: "Conexão estabelecida com sucesso",
            data: resultado
        };

    } catch (error) {
        console.error("❌ Falha no teste de conexão com Alterdata:", error);
        return {
            success: false,
            message: error.message,
            error: error.toString()
        };
    }
}

/**
 * 📌 Função para buscar documentos de um cliente específico
 */
async function buscarDocumentosCliente(empresaId, clienteId, filtros = {}) {
    console.log(`🔍 Buscando documentos do cliente ${clienteId} na empresa ${empresaId}`);

    try {
        // Primeiro, buscar informações do cliente para obter o empresaId do Alterdata
        const [cliente] = await db.query(
            "SELECT * FROM clientes WHERE id = ? AND empresaId = ?",
            [clienteId, empresaId]
        );

        if (!cliente.length) {
            throw new Error("Cliente não encontrado.");
        }

        // Por enquanto, vamos usar o mesmo empresaId da empresa
        // Em uma implementação futura, você pode mapear o cliente para o empresaId correto do Alterdata
        const alterdataEmpresaId = empresaId;

        const documentos = await consultarDocumentosAlterdata(alterdataEmpresaId, {
            ...filtros,
            'page[limit]': filtros.pageLimit || 10
        });

        console.log(`✅ Documentos do cliente ${clienteId} obtidos com sucesso!`);
        return documentos;

    } catch (error) {
        console.error("❌ Erro ao buscar documentos do cliente:", error);
        throw new Error(`Erro ao buscar documentos do cliente: ${error.message}`);
    }
}

/**
 * 📌 Função para listar empresas disponíveis no Alterdata
 */
async function listarEmpresasAlterdata(empresaId) {
    console.log(`🔍 Listando empresas disponíveis no Alterdata para empresa ID: ${empresaId}`);

    try {
        const token = await obterTokenEplugin(empresaId);

        if (!token) {
            throw new Error("❌ Nenhum token válido do Eplugin encontrado.");
        }

        let todasEmpresas = [];
        let offset = 0;
        const limit = 50;
        let continuar = true;

        console.log("🔄 Iniciando busca paginada de empresas...");

        while (continuar) {
            try {
                console.log(`📄 Buscando página ${Math.floor(offset / limit) + 1} (offset: ${offset})`);
                
                const response = await axios.get(`${API_BASE_URL}/empresas`, {
                    headers: {
                        "Authorization": `Bearer ${token}`,
                        "Content-Type": "application/json"
                    },
                    params: {
                        "page[limit]": limit,
                        "page[offset]": offset
                    }
                });

                const empresas = response.data?.data || [];
                todasEmpresas.push(...empresas);

                console.log(`✅ Página ${Math.floor(offset / limit) + 1}: ${empresas.length} empresas encontradas`);

                // Se retornou menos empresas que o limite, chegamos ao fim
                if (empresas.length < limit) {
                    continuar = false;
                    console.log("🏁 Última página alcançada");
                } else {
                    offset += limit;
                }
            } catch (error) {
                console.error(`❌ Erro ao buscar página ${Math.floor(offset / limit) + 1}:`, error.response?.data || error.message);
                break;
            }
        }

        console.log(`✅ Busca concluída! Total de empresas obtidas: ${todasEmpresas.length}`);
        
        return {
            data: todasEmpresas,
            meta: {
                total: todasEmpresas.length,
                paginas: Math.ceil(todasEmpresas.length / limit),
                limite: limit
            }
        };

    } catch (error) {
        console.error("❌ Erro ao listar empresas do Alterdata:", error.response?.data || error.message);
        throw new Error(`Erro ao listar empresas do Alterdata: ${error.response?.statusText || error.message}`);
    }
}

/**
 * 📌 Função para buscar documentos de todas as empresas
 */
async function buscarDocumentosTodasEmpresas(empresaId) {
    try {
        const token = await obterTokenEplugin(empresaId);
        if (!token) {
            throw new Error("❌ Nenhum token válido do Eplugin encontrado para a empresa principal.");
        }
        
        const empresasResult = await listarEmpresasAlterdata(empresaId);
        const empresas = empresasResult.data || [];
        const resultados = [];
        
        console.log(`\n📊 INICIANDO BUSCA DE DOCUMENTOS`);
        console.log(`📋 Total de empresas: ${empresas.length}\n`);
        
        for (let i = 0; i < empresas.length; i++) {
            const empresa = empresas[i];
            const empresaAlterdataId = empresa.id;
            const empresaCnpj = empresa.attributes?.cpfcnpj;
            const empresaNome = empresa.attributes?.nome || empresaCnpj || 'Nome não disponível';
            
            try {
                let documentos;
                let metodoBusca = 'ID';
                let erroCNPJ = null;
                let erroID = null;
                
                // Primeira tentativa: buscar por CNPJ
                try {
                    console.log(`   🔍 Tentando buscar documentos por CNPJ: ${empresaCnpj}`);
                    documentos = await consultarDocumentosAlterdata(empresaCnpj, {
                        'page[limit]': 5,
                        sort: '-criacao'
                    }, token);
                    metodoBusca = 'CNPJ';
                    console.log(`   ✅ Sucesso com CNPJ`);
                } catch (error) {
                    erroCNPJ = error.message;
                    console.log(`   ❌ Falha com CNPJ: ${error.message}`);
                    
                    // Segunda tentativa: buscar por ID
                    try {
                        console.log(`   🔍 Tentando buscar documentos por ID: ${empresaAlterdataId}`);
                        documentos = await consultarDocumentosAlterdata(empresaAlterdataId, {
                            'page[limit]': 5,
                            sort: '-criacao'
                        }, token);
                        metodoBusca = 'ID';
                        console.log(`   ✅ Sucesso com ID`);
                    } catch (error2) {
                        erroID = error2.message;
                        console.log(`   ❌ Falha com ID: ${error2.message}`);
                        throw new Error(`Falha em ambos os métodos. CNPJ: ${erroCNPJ}, ID: ${erroID}`);
                    }
                }
                
                const totalDocumentos = documentos.data?.length || 0;
                
                if (totalDocumentos > 0) {
                    console.log(`✅ [${i + 1}/${empresas.length}] ${empresaNome}`);
                    console.log(`   📄 ${totalDocumentos} documentos encontrados (${metodoBusca})`);
                    
                                         // Mostrar detalhes dos documentos
                     documentos.data.forEach((doc, idx) => {
                         const docNome = doc.attributes?.nome || doc.attributes?.titulo || 'Documento sem nome';
                         const docData = doc.attributes?.criacao || doc.attributes?.data || 'Data não disponível';
                         const docCategoria = doc.attributes?.categoria?.nome || doc.attributes?.pasta || 'Sem categoria';
                         const docStatus = doc.attributes?.status?.nome || 'Status não disponível';
                         console.log(`   📋 ${idx + 1}. ${docNome} - ${docData}`);
                         console.log(`      📁 Categoria: ${docCategoria} | Status: ${docStatus}`);
                     });
                    console.log('');
                }
                
                resultados.push({
                    empresa: {
                        id: empresaAlterdataId,
                        nome: empresaNome,
                        cpfcnpj: empresaCnpj,
                        metodoBusca: metodoBusca
                    },
                    documentos: documentos.data || [],
                    total: totalDocumentos,
                    success: true
                });
                
            } catch (error) {
                console.log(`❌ [${i + 1}/${empresas.length}] ${empresaNome} - ERRO: ${error.message}`);
                console.log(`   ⏭️  Continuando para próxima empresa...\n`);
                
                resultados.push({
                    empresa: {
                        id: empresaAlterdataId,
                        nome: empresaNome,
                        cpfcnpj: empresaCnpj
                    },
                    documentos: [],
                    total: 0,
                    success: false,
                    error: error.message
                });
            }
            
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        const empresasComDocumentos = resultados.filter(r => r.success && r.total > 0).length;
        const empresasComErro = resultados.filter(r => !r.success).length;
        const totalDocumentos = resultados.reduce((sum, r) => sum + (r.total || 0), 0);
        
        console.log(`\n🏁 RESUMO FINAL`);
        console.log(`📊 Empresas processadas: ${empresas.length}`);
        console.log(`✅ Empresas com documentos: ${empresasComDocumentos}`);
        console.log(`❌ Empresas com erro: ${empresasComErro}`);
        console.log(`📄 Total de documentos: ${totalDocumentos}\n`);
        
        return {
            empresas: empresas,
            resultados: resultados,
            meta: {
                totalEmpresas: empresas.length,
                empresasComDocumentos: empresasComDocumentos,
                empresasComErro: empresasComErro,
                totalDocumentos: totalDocumentos
            }
        };
        
    } catch (error) {
        console.error("❌ Erro ao buscar documentos de todas as empresas:", error);
        throw new Error(`Erro ao buscar documentos de todas as empresas: ${error.message}`);
    }
}

/**
 * 📌 Função para buscar categorias/pastas de documentos
 */
async function buscarCategoriasDocumentos(empresaId) {
    try {
        const token = await obterTokenEplugin(empresaId);
        if (!token) {
            throw new Error("❌ Nenhum token válido do Eplugin encontrado.");
        }
        
        console.log(`\n📁 BUSCANDO CATEGORIAS DE DOCUMENTOS`);
        
        // Primeiro, buscar empresas do Alterdata para encontrar uma válida
        const empresasResult = await listarEmpresasAlterdata(empresaId);
        const empresas = empresasResult.data || [];
        
        if (empresas.length === 0) {
            throw new Error("❌ Nenhuma empresa encontrada no Alterdata para buscar categorias.");
        }
        
        console.log(`📋 Total de empresas disponíveis: ${empresas.length}`);
        
        // Usar a primeira empresa que tenha documentos
        let empresaComDocumentos = null;
        let categorias = new Set();
        let status = new Set();
        let totalDocumentos = 0;
        
        for (let i = 0; i < Math.min(empresas.length, 10); i++) { // Testar apenas as primeiras 10
            const empresa = empresas[i];
            const empresaAlterdataId = empresa.id;
            const empresaCnpj = empresa.attributes?.cpfcnpj;
            const empresaNome = empresa.attributes?.nome || empresaCnpj || 'Nome não disponível';
            
            try {
                let documentos;
                
                try {
                    documentos = await consultarDocumentosAlterdata(empresaCnpj, {
                        'page[limit]': 20,
                        include: 'categoria,status',
                        sort: '-criacao'
                    }, token);
                } catch (error) {
                    documentos = await consultarDocumentosAlterdata(empresaAlterdataId, {
                        'page[limit]': 20,
                        include: 'categoria,status',
                        sort: '-criacao'
                    }, token);
                }
                
                const docsEncontrados = documentos.data?.length || 0;
                totalDocumentos += docsEncontrados;
                
                                 if (docsEncontrados > 0) {
                     console.log(`✅ Empresa com documentos: ${empresaNome} (${docsEncontrados} docs)`);
                     
                     documentos.data?.forEach((doc, idx) => {
                         // Coletar categorias e status
                         if (doc.attributes?.categoria) {
                             categorias.add(doc.attributes.categoria);
                         }
                         if (doc.attributes?.status) {
                             status.add(doc.attributes.status);
                         }
                         
                         // Log detalhado do documento
                         console.log(`   📋 Documento ${idx + 1}:`);
                         console.log(`      🔗 ID: ${doc.id || 'Não informado'}`);
                         console.log(`      📝 Tipo: ${doc.type || 'Não informado'}`);
                         console.log(`      📄 Título: ${doc.attributes?.titulo || 'Sem título'}`);
                         console.log(`      📝 Descrição: ${doc.attributes?.descricao || 'Sem descrição'}`);
                         console.log(`      📅 Data Criação: ${doc.attributes?.criacao || 'Não informada'}`);
                         console.log(`      📅 Data Vencimento: ${doc.attributes?.vencimento || 'Não informada'}`);
                         console.log(`      📅 Data Pagamento: ${doc.attributes?.pagamento || 'Não informada'}`);
                         console.log(`      📅 Data Expiração: ${doc.attributes?.expiracao || 'Não informada'}`);
                         console.log(`      💰 Valor: R$ ${doc.attributes?.valor || 0}`);
                         console.log(`      💰 Pago: ${doc.attributes?.pago ? 'Sim' : 'Não'}`);
                         console.log(`      📁 Categoria: ${doc.attributes?.categoria || 'Sem categoria'}`);
                         console.log(`      🏷️ Status: ${doc.attributes?.status || 'Sem status'}`);
                         console.log(`      🏢 Empresa ID: ${doc.attributes?.empresaId || 'Não informado'}`);
                         console.log(`      🏛️ Departamento: ${doc.attributes?.departamento || 'Não informado'}`);
                         
                         // Relacionamentos
                         if (doc.relationships) {
                             console.log(`      🔗 Relacionamentos:`);
                             Object.keys(doc.relationships).forEach(rel => {
                                 const relData = doc.relationships[rel];
                                 console.log(`         📎 ${rel}: ${relData.data?.length || 0} itens`);
                             });
                         }
                         
                         // Links
                         if (doc.links) {
                             console.log(`      🔗 Links:`);
                             Object.keys(doc.links).forEach(link => {
                                 console.log(`         🔗 ${link}: ${doc.links[link]}`);
                             });
                         }
                         
                         console.log('');
                     });
                     
                     if (!empresaComDocumentos) {
                         empresaComDocumentos = empresa;
                     }
                 }
                
            } catch (error) {
                // Continuar para próxima empresa
            }
            
            await new Promise(resolve => setTimeout(resolve, 50));
        }
        
        console.log(`📊 Documentos analisados: ${totalDocumentos}`);
        console.log(`📁 Categorias encontradas: ${categorias.size}`);
        console.log(`🏷️ Status encontrados: ${status.size}\n`);
        
        if (categorias.size > 0) {
            console.log(`📁 LISTA DE CATEGORIAS:`);
            Array.from(categorias).forEach((cat, idx) => {
                console.log(`   ${idx + 1}. ${cat}`);
            });
            console.log('');
        }
        
        if (status.size > 0) {
            console.log(`🏷️ LISTA DE STATUS:`);
            Array.from(status).forEach((stat, idx) => {
                console.log(`   ${idx + 1}. ${stat}`);
            });
            console.log('');
        }
        
                 // Log da estrutura completa da resposta
         if (empresaComDocumentos && documentos) {
             console.log(`\n🔍 ESTRUTURA COMPLETA DA RESPOSTA:`);
             console.log(`📋 Empresa: ${empresaComDocumentos.attributes?.nome}`);
             console.log(`📊 Meta da resposta:`);
             console.log(`   📄 Total de recursos: ${documentos.meta?.totalResourceCount || 'Não informado'}`);
             console.log(`   📄 Documentos nesta página: ${documentos.data?.length || 0}`);
             
             if (documentos.links) {
                 console.log(`🔗 Links de paginação:`);
                 Object.keys(documentos.links).forEach(link => {
                     console.log(`   🔗 ${link}: ${documentos.links[link]}`);
                 });
             }
             
             console.log(`\n📊 ESTRUTURA JSON COMPLETA DA RESPOSTA:`);
             console.log(JSON.stringify(documentos, null, 2));
             console.log('');
         }
         
         return {
             categorias: Array.from(categorias),
             status: Array.from(status),
             totalDocumentos: totalDocumentos,
             empresaUsada: empresaComDocumentos ? {
                 id: empresaComDocumentos.id,
                 nome: empresaComDocumentos.attributes?.nome,
                 cnpj: empresaComDocumentos.attributes?.cpfcnpj
             } : null,
             exemploDocumento: documentos?.data?.[0] || null
         };
        
    } catch (error) {
        console.error("❌ Erro ao buscar categorias:", error);
        throw new Error(`Erro ao buscar categorias: ${error.message}`);
    }
}

/**
 * 📌 Função para obter o conteúdo/base64 de um documento específico
 */
async function obterConteudoDocumento(documentoId, empresaId, cnpjLimpo = null) {
    console.log(`📄 Obtendo conteúdo do documento ID: ${documentoId} para empresa ID: ${empresaId}`);

    try {
        const token = await obterTokenEplugin(empresaId);
        if (!token) {
            throw new Error("❌ Nenhum token válido do Eplugin encontrado.");
        }

        // Construir o link de arquivos baseado no padrão da API
        const arquivosLink = `${API_DOCUMENTOS_BASE_URL}/integracao/documentos/${documentoId}/arquivos`;
        console.log(`    🔍 Tentando acessar arquivos diretamente: ${arquivosLink}`);
        
        try {
            const arquivosResponse = await axios.get(arquivosLink, {
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": "application/json"
                }
            });
            
            console.log(`    ✅ Arquivos obtidos com sucesso!`);
            console.log(`    📊 Tipo de resposta: ${typeof arquivosResponse.data}`);
            console.log(`    📏 Tamanho da resposta: ${JSON.stringify(arquivosResponse.data).length} caracteres`);
            
            // Extrair o conteúdo base64 da estrutura correta
            let conteudoBase64 = null;
            if (arquivosResponse.data?.data && Array.isArray(arquivosResponse.data.data)) {
                // Procurar pelo primeiro arquivo com bytes
                for (const arquivo of arquivosResponse.data.data) {
                    if (arquivo.attributes?.bytes) {
                        conteudoBase64 = arquivo.attributes.bytes;
                        console.log(`    ✅ Conteúdo base64 encontrado! Tamanho: ${conteudoBase64.length} caracteres`);
                        break;
                    }
                }
            }
            
            return {
                success: true,
                endpoint: arquivosLink,
                data: conteudoBase64 || arquivosResponse.data,
                contentType: arquivosResponse.headers['content-type'],
                contentLength: arquivosResponse.headers['content-length'],
                cnpjUsado: cnpjLimpo,
                cnpjLimpoUsado: cnpjLimpo
            };
        } catch (errorArquivos) {
            console.log(`    ❌ Falha ao acessar arquivos: ${errorArquivos.response?.status} - ${errorArquivos.response?.statusText}`);
            
            // Se falhou, tentar buscar o documento primeiro para obter o link correto
            try {
                console.log(`    🔍 Buscando documento ${documentoId} para obter link de arquivos...`);
                
                let url = `${API_DOCUMENTOS_BASE_URL}/integracao/documentos/${documentoId}`;
                
                // Se um CNPJ foi fornecido, adicionar como filtro
                if (cnpjLimpo) {
                    url += `?filter[empresaId]=${cnpjLimpo}`;
                }
                
                const docResponse = await axios.get(url, {
                    headers: {
                        "Authorization": `Bearer ${token}`,
                        "Content-Type": "application/json"
                    }
                });

                const documento = docResponse.data?.data;
                console.log(`    📋 Documento encontrado: ${documento ? 'Sim' : 'Não'}`);
                
                if (documento && documento.relationships?.arquivos?.links?.related) {
                    const arquivosLink = documento.relationships.arquivos.links.related;
                    console.log(`    🔍 Tentando acessar link de arquivos: ${arquivosLink}`);
                    
                    try {
                        const arquivosResponse2 = await axios.get(arquivosLink, {
                            headers: {
                                "Authorization": `Bearer ${token}`,
                                "Content-Type": "application/json"
                            }
                        });
                        
                        console.log(`    ✅ Arquivos obtidos com sucesso!`);
                        console.log(`    📊 Tipo de resposta: ${typeof arquivosResponse2.data}`);
                        console.log(`    📏 Tamanho da resposta: ${JSON.stringify(arquivosResponse2.data).length} caracteres`);
                        
                        // Extrair o conteúdo base64 da estrutura correta
                        let conteudoBase64 = null;
                        if (arquivosResponse2.data?.data && Array.isArray(arquivosResponse2.data.data)) {
                            // Procurar pelo primeiro arquivo com bytes
                            for (const arquivo of arquivosResponse2.data.data) {
                                if (arquivo.attributes?.bytes) {
                                    conteudoBase64 = arquivo.attributes.bytes;
                                    console.log(`    ✅ Conteúdo base64 encontrado! Tamanho: ${conteudoBase64.length} caracteres`);
                                    break;
                                }
                            }
                        }
                        
                        return {
                            success: true,
                            endpoint: arquivosLink,
                            data: conteudoBase64 || arquivosResponse2.data,
                            contentType: arquivosResponse2.headers['content-type'],
                            contentLength: arquivosResponse2.headers['content-length'],
                            documentoOriginal: documento,
                            cnpjUsado: cnpjLimpo,
                            cnpjLimpoUsado: cnpjLimpo
                        };
                    } catch (errorArquivos2) {
                        console.log(`    ❌ Falha ao acessar arquivos via link: ${errorArquivos2.response?.status} - ${errorArquivos2.response?.statusText}`);
                    }
                }
            } catch (errorDoc) {
                console.log(`    ❌ Falha ao buscar documento: ${errorDoc.response?.status} - ${errorDoc.response?.statusText}`);
            }
        }

        throw new Error("❌ Nenhum link válido encontrado para obter o conteúdo do documento.");

    } catch (error) {
        console.error("❌ Erro ao obter conteúdo do documento:", error);
        return {
            success: false,
            message: error.message,
            error: error.toString()
        };
    }
}

/**
 * 📌 Função para analisar a estrutura dos dados retornados
 */
async function analisarEstruturaDocumentos(empresaId) {
    console.log(`🔍 Analisando estrutura de documentos para empresa ID: ${empresaId}`);

    try {
        const resultado = await consultarDocumentosAlterdata(empresaId, {
            'page[limit]': 1,
            include: 'abridor,categoria,status,empresa,departamento'
        });

        const primeiroItem = resultado?.data?.[0];
        
        if (!primeiroItem) {
            return {
                status: 404,
                estrutura: {
                    temData: false,
                    tipoData: "N/A",
                    tamanhoData: 0,
                    camposPrimeiroItem: [],
                    exemploPrimeiroItem: null
                },
                dadosCompletos: resultado
            };
        }

        // Analisar estrutura
        const estrutura = {
            temData: !!primeiroItem.attributes?.criacao,
            tipoData: typeof primeiroItem.attributes?.criacao,
            tamanhoData: primeiroItem.attributes?.criacao?.length || 0,
            camposPrimeiroItem: Object.keys(primeiroItem.attributes || {}),
            exemploPrimeiroItem: primeiroItem
        };

        console.log("✅ Análise de estrutura concluída!");
        return {
            status: 200,
            estrutura,
            dadosCompletos: resultado
        };

    } catch (error) {
        console.error("❌ Erro ao analisar estrutura:", error);
        return {
            status: 500,
            estrutura: {
                temData: false,
                tipoData: "error",
                tamanhoData: 0,
                camposPrimeiroItem: [],
                exemploPrimeiroItem: null
            },
            dadosCompletos: null,
            error: error.message
        };
    }
}

module.exports = { 
    obterTodasEmpresas, 
    obterCertidaoNegativa, 
    importarEmpresasParaBD, 
    obterTokenEplugin,
    consultarDocumentosAlterdata,
    testarConexaoAlterdata,
    buscarDocumentosCliente,
    analisarEstruturaDocumentos,
    listarEmpresasAlterdata,
    buscarDocumentosTodasEmpresas,
    buscarCategoriasDocumentos,
    obterConteudoDocumento
};
