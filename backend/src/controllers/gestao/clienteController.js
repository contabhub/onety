const db = require("../../config/database");
const { importarEmpresasParaBD } = require("../../services/gestao/epluginService");

// Dores e soluções fixas
const DORES_FIXAS = [
  "Tributário",
  "Financeiro",
  "Gestão de pessoas",
  "Marketing e vendas",
  "Nenhuma dor aparente"
];
const SOLUCOES_FIXAS = [
  "Projeto tributário",
  "Recrutamento e Seleção",
  "Empresa inquebrável",
  "Curadoria",
  "Consultoria Financeira - CDC",
  "Consultoria Financeira - Implantação",
  "Marketing - indicação"
];

const DORES_SOLUCOES_MAP = {
  "Tributário": ["Projeto tributário"],
  "Financeiro": ["Curadoria", "Consultoria Financeira - CDC", "Consultoria Financeira - Implantação"],
  "Gestão de pessoas": ["Recrutamento e Seleção", "Empresa inquebrável"],
  "Marketing e vendas": ["Marketing - indicação"],
  "Nenhuma dor aparente": []
};

// Endpoint para listar dores
const listarDores = (req, res) => {
  res.json(DORES_FIXAS);
};
// Endpoint para listar soluções
const listarSolucoes = (req, res) => {
  res.json(SOLUCOES_FIXAS);
};

// Endpoint para retornar o mapeamento dores -> soluções
const mapearDoresSolucoes = (req, res) => {
  res.json(DORES_SOLUCOES_MAP);
};

const cadastrarCliente = async (req, res) => {
    try {
        const usuarioId = req.usuario?.id;
        const { nome, cnpjCpf, telefone, email, endereco, empresaId, dores, solucoes } = req.body;

        if (!usuarioId) {
            return res.status(401).json({ error: "Usuário não autenticado." });
        }

        if (!nome || !cnpjCpf || !empresaId) {
            return res.status(400).json({ error: "Nome, CNPJ/CPF e empresaId são obrigatórios." });
        }

        // Verifica se a empresa pertence ao usuário
        const [empresa] = await db.query("SELECT id FROM empresas WHERE id = ? AND usuarioId = ?", [empresaId, usuarioId]);

        if (empresa.length === 0) {
            return res.status(403).json({ error: "Usuário não tem permissão para adicionar clientes a essa empresa." });
        }

        // Verifica se o cliente já existe
        const [clienteExistente] = await db.query("SELECT id FROM clientes WHERE cnpjCpf = ?", [cnpjCpf]);

        let clienteId;
        if (clienteExistente.length > 0) {
            clienteId = clienteExistente[0].id;
        } else {
            // Insere o cliente se ele não existir
            const [novoCliente] = await db.query(
                "INSERT INTO clientes (nome, cnpjCpf, telefone, email, endereco) VALUES (?, ?, ?, ?, ?)",
                [nome, cnpjCpf, telefone || null, email || null, endereco || null]
            );
            clienteId = novoCliente.insertId;
        }

        // Verifica se a relação já existe
        const [relacaoExistente] = await db.query("SELECT id FROM relacao_empresas WHERE empresaId = ? AND clienteId = ?", [empresaId, clienteId]);

        if (relacaoExistente.length > 0) {
            return res.status(400).json({ error: "Cliente já associado a essa empresa." });
        }

        // Associa o cliente à empresa
        await db.query(
            "INSERT INTO relacao_empresas (usuarioId, empresaId, clienteId, dataAssociacao) VALUES (?, ?, ?, NOW())",
            [usuarioId, empresaId, clienteId]
        );

        // Salva dores e soluções se enviados
        if (dores && Array.isArray(dores)) {
          await db.query('DELETE FROM clientes_dores WHERE cliente_id = ?', [clienteId]);
          for (const dor of dores) {
            await db.query('INSERT INTO clientes_dores (cliente_id, dor) VALUES (?, ?)', [clienteId, dor]);
          }
        }
        if (solucoes && Array.isArray(solucoes)) {
          await db.query('DELETE FROM clientes_solucoes WHERE cliente_id = ?', [clienteId]);
          for (const solucao of solucoes) {
            await db.query('INSERT INTO clientes_solucoes (cliente_id, solucao) VALUES (?, ?)', [clienteId, solucao]);
          }
        }

        res.status(201).json({ message: "Cliente cadastrado e associado à empresa com sucesso!" });

    } catch (error) {
        console.error("❌ Erro ao cadastrar cliente:", error);
        res.status(500).json({ error: "Erro ao cadastrar cliente." });
    }
};

const listarClientesPorEmpresa = async (req, res) => {
    try {
        const usuarioId = req.usuario?.id;
        const { empresaId } = req.params;

        if (!usuarioId) {
            return res.status(401).json({ error: "Usuário não autenticado." });
        }

        // Verifica se a empresa pertence ao usuário
        const [empresa] = await db.query("SELECT id FROM empresas WHERE id = ? AND usuarioId = ?", [empresaId, usuarioId]);

        if (empresa.length === 0) {
            return res.status(403).json({ error: "Usuário não tem permissão para visualizar clientes desta empresa." });
        }

        // Busca os clientes associados a essa empresa
        const [clientes] = await db.query(
            `SELECT c.id, c.nome, c.cnpjCpf, c.telefone, c.email, c.endereco
             FROM relacao_empresas re
             JOIN clientes c ON re.clienteId = c.id
             WHERE re.empresaId = ?`, 
            [empresaId]
        );

        res.json(clientes);
    } catch (error) {
        console.error("❌ Erro ao listar clientes:", error);
        res.status(500).json({ error: "Erro ao listar clientes." });
    }
};

const removerClienteDaEmpresa = async (req, res) => {
    try {
        const usuarioId = req.usuario?.id;
        const { empresaId, clienteId } = req.params;

        if (!usuarioId) {
            return res.status(401).json({ error: "Usuário não autenticado." });
        }

        const [empresa] = await db.query("SELECT id FROM empresas WHERE id = ? AND usuarioId = ?", [empresaId, usuarioId]);

        if (empresa.length === 0) {
            return res.status(403).json({ error: "Usuário não tem permissão para remover clientes desta empresa." });
        }

        await db.query("DELETE FROM relacao_empresas WHERE empresaId = ? AND clienteId = ?", [empresaId, clienteId]);

        res.json({ message: "Cliente removido da empresa com sucesso!" });
    } catch (error) {
        console.error("❌ Erro ao remover cliente da empresa:", error);
        res.status(500).json({ error: "Erro ao remover cliente." });
    }
};

const importarEmpresas = async (req, res) => {
    try {
        const { empresaId, usuarioId } = req.body;

        console.log("📡 Requisição recebida para importar empresas...");
        console.log(`🔍 Empresa ID: ${empresaId}, Usuário ID: ${usuarioId}`);

        if (!empresaId || !usuarioId) {
            console.warn("⚠ Faltando empresaId ou usuarioId");
            return res.status(400).json({ error: "ID da empresa e ID do usuário são obrigatórios." });
        }

        // ✅ Aqui o `await` está correto porque estamos dentro de uma `async function`
        const resultado = await importarEmpresasParaBD(empresaId, usuarioId);
        
        console.log("✅ Empresas importadas com sucesso!", resultado);
        res.json({ success: true, message: "Empresas importadas com sucesso.", data: resultado });
    } catch (error) {
        console.error("❌ Erro na importação:", error);
        res.status(500).json({ error: "Erro ao importar empresas.", detalhes: error.message });
    }
};

const aplicarResponsavelDepartamento = async (req, res) => {
    try {
        const usuarioId = req.usuario?.id;
        const { clienteId } = req.params;
        const { departamentoId, usuarioId: responsavelId } = req.body;

        // DEBUG INÍCIO
        console.log("==== DEBUG aplicarResponsavelDepartamento ====");
        console.log("clienteId:", clienteId, "departamentoId:", departamentoId, "responsavelId:", responsavelId);

        if (!usuarioId) {
            return res.status(401).json({ error: "Usuário não autenticado." });
        }

        if (!departamentoId || !responsavelId) {
            return res.status(400).json({ error: "Departamento ID e Usuário ID são obrigatórios." });
        }

        // Verifica se o usuário tem permissão para acessar este cliente
        // Primeiro, buscar a empresa do cliente
        const [clienteEmpresa] = await db.query(`
            SELECT empresaId 
            FROM clientes 
            WHERE id = ?
        `, [clienteId]);

        if (clienteEmpresa.length === 0) {
            return res.status(404).json({ error: "Cliente não encontrado." });
        }

        // Verificar se o usuário tem acesso à empresa do cliente
        const [clientePermissao] = await db.query(
            `SELECT re.empresaId FROM relacao_empresas re
             WHERE re.empresaId = ? AND re.usuarioId = ?`,
            [clienteEmpresa[0].empresaId, usuarioId]
        );

        if (clientePermissao.length === 0) {
            return res.status(403).json({ error: "Usuário não tem permissão para acessar este cliente." });
        }

        // 1. Buscar respostas do cliente
        const [respostas] = await db.query(`
            SELECT r.particularidadeId
            FROM cliente_respostas cr
            JOIN enquete_respostas r ON cr.respostaId = r.id
            WHERE cr.clienteId = ?
        `, [clienteId]);
        const particularidadesCliente = respostas.map(r => r.particularidadeId);

        // 2. Buscar obrigações com suas particularidades
        const [obrigacoesComParticularidades] = await db.query(`
            SELECT 
                o.id as obrigacaoId, 
                o.nome,
                op.tipo as tipoPart,
                op.particularidadeId
            FROM obrigacoes o
            JOIN obrigacoes_particularidades op ON op.obrigacaoId = o.id
            WHERE o.departamentoId = ?
        `, [departamentoId]);

        // 3. Agrupar particularidades por obrigação
        const obrigacoesMap = {};
        for (const row of obrigacoesComParticularidades) {
            if (!obrigacoesMap[row.obrigacaoId]) {
                obrigacoesMap[row.obrigacaoId] = {
                    obrigacaoId: row.obrigacaoId,
                    nome: row.nome,
                    particularidadesE: [],
                    particularidadesOU: [],
                    particularidadesEXCETO: []
                };
            }

            if (row.tipoPart === "E") {
                obrigacoesMap[row.obrigacaoId].particularidadesE.push(row.particularidadeId);
            } else if (row.tipoPart === "OU") {
                obrigacoesMap[row.obrigacaoId].particularidadesOU.push(row.particularidadeId);
            } else if (row.tipoPart === "EXCETO") {
                obrigacoesMap[row.obrigacaoId].particularidadesEXCETO.push(row.particularidadeId);
            }
        }

        // 4. Validar match para cada obrigação
        const obrigacoes = Object.values(obrigacoesMap).filter(o => {
            const temTodasE = o.particularidadesE.every(p => particularidadesCliente.includes(p));
            const temAlgumaOU = o.particularidadesOU.length === 0 || o.particularidadesOU.some(p => particularidadesCliente.includes(p));
            const temAlgumExceto = o.particularidadesEXCETO.length > 0 && o.particularidadesEXCETO.some(p => particularidadesCliente.includes(p));
            return temTodasE && temAlgumaOU && !temAlgumExceto;
        });

        // DEBUG obrigações encontradas
        console.log("Obrigações encontradas:", obrigacoes.map(o => ({ obrigacaoId: o.obrigacaoId, nome: o.nome })));

        if (obrigacoes.length === 0) {
            return res.status(404).json({ error: "Nenhuma obrigação encontrada para este cliente e departamento." });
        }

        // Aplica o responsável para todas as obrigações do departamento
        for (const obrigacao of obrigacoes) {
            console.log("Vinculando responsável para obrigação:", obrigacao.nome, "ID:", obrigacao.obrigacaoId);
            await db.query(
                `INSERT INTO obrigacoes_responsaveis_cliente (obrigacaoId, clienteId, usuarioId) 
                 VALUES (?, ?, ?) 
                 ON DUPLICATE KEY UPDATE usuarioId = ?`,
                [obrigacao.obrigacaoId, clienteId, responsavelId, responsavelId]
            );
        }

        res.json({ 
            message: "Responsável aplicado com sucesso!", 
            obrigacoesAtualizadas: obrigacoes.length 
        });
    } catch (error) {
        console.error("❌ Erro ao aplicar responsável por departamento:", error);
        res.status(500).json({ error: "Erro ao aplicar responsável." });
    }
};

// 🔹 Buscar particularidades do cliente
const buscarParticularidadesCliente = async (req, res) => {
    try {
        const { id } = req.params;
        const usuarioId = req.usuario?.id;

        if (!usuarioId) {
            return res.status(401).json({ error: "Usuário não autenticado." });
        }

        if (!id) {
            return res.status(400).json({ error: "ID do cliente é obrigatório." });
        }

        // Verificar se o usuário tem permissão para acessar este cliente
        // Primeiro, buscar a empresa do cliente
        const [clienteEmpresa] = await db.query(`
            SELECT empresaId 
            FROM clientes 
            WHERE id = ?
        `, [id]);

        if (clienteEmpresa.length === 0) {
            return res.status(404).json({ error: "Cliente não encontrado." });
        }

        // Verificar se o usuário tem acesso à empresa do cliente
        const [clientePermissao] = await db.query(`
            SELECT re.empresaId 
            FROM relacao_empresas re
            WHERE re.empresaId = ? AND re.usuarioId = ?
        `, [clienteEmpresa[0].empresaId, usuarioId]);

        if (clientePermissao.length === 0) {
            return res.status(403).json({ error: "Usuário não tem permissão para acessar este cliente." });
        }

        // Buscar as particularidades do cliente da tabela cliente_respostas
        const [particularidades] = await db.query(`
            SELECT 
                cr.respostaId,
                er.particularidadeId,
                ep.texto as perguntaNome,
                ep.grupoid as perguntaGrupoId,
                pr.nome as respostaNome,
                pr.descricao as respostaDescricao
            FROM cliente_respostas cr
            JOIN enquete_respostas er ON cr.respostaId = er.id
            JOIN enquete_perguntas ep ON er.perguntaId = ep.id
            JOIN particularidades pr ON er.particularidadeId = pr.id
            WHERE cr.clienteId = ?
            ORDER BY ep.grupoid, ep.texto
        `, [id]);

        res.json(particularidades);
    } catch (error) {
        console.error("❌ Erro ao buscar particularidades do cliente:", error);
        res.status(500).json({ error: "Erro ao buscar particularidades do cliente." });
    }
};

// 🔹 Replicar perfil do cliente
const replicarPerfilCliente = async (req, res) => {
    try {
        const { clienteOrigemId, clienteDestinoIds, particularidades, grupoIds } = req.body;
        const usuarioId = req.usuario?.id;

        console.log("🔍 [REPLICAR PERFIL] Dados recebidos:", {
            clienteOrigemId,
            clienteDestinoIds,
            particularidades,
            grupoIds,
            usuarioId
        });

        if (!usuarioId) {
            return res.status(401).json({ error: "Usuário não autenticado." });
        }

        if (!clienteOrigemId || !clienteDestinoIds || !Array.isArray(clienteDestinoIds)) {
            return res.status(400).json({ error: "clienteOrigemId e clienteDestinoIds são obrigatórios." });
        }

        // Verificar se o usuário tem permissão para acessar o cliente origem
        // Primeiro, buscar a empresa do cliente origem
        const [clienteOrigemEmpresa] = await db.query(`
            SELECT empresaId 
            FROM clientes 
            WHERE id = ?
        `, [clienteOrigemId]);

        if (clienteOrigemEmpresa.length === 0) {
            return res.status(404).json({ error: "Cliente origem não encontrado." });
        }

        // Verificar se o usuário tem acesso à empresa do cliente origem
        const [clientePermissao] = await db.query(`
            SELECT re.empresaId 
            FROM relacao_empresas re
            WHERE re.empresaId = ? AND re.usuarioId = ?
        `, [clienteOrigemEmpresa[0].empresaId, usuarioId]);

        if (clientePermissao.length === 0) {
            return res.status(403).json({ error: "Usuário não tem permissão para acessar este cliente." });
        }

        let replicados = 0;
        console.log("🔍 [REPLICAR PERFIL] Iniciando replicação para", clienteDestinoIds.length, "clientes");

        for (const clienteDestinoId of clienteDestinoIds) {
            try {
                console.log("🔍 [REPLICAR PERFIL] Processando cliente destino:", clienteDestinoId);
                
                // Verificar se o cliente destino existe e se o usuário tem permissão
                // Primeiro, buscar a empresa do cliente destino
                const [clienteDestinoEmpresa] = await db.query(`
                    SELECT empresaId 
                    FROM clientes 
                    WHERE id = ?
                `, [clienteDestinoId]);

                if (clienteDestinoEmpresa.length === 0) {
                    console.warn(`Cliente destino ${clienteDestinoId} não encontrado`);
                    continue;
                }

                // Verificar se o usuário tem acesso à empresa do cliente destino
                const [clienteDestino] = await db.query(`
                    SELECT re.empresaId 
                    FROM relacao_empresas re
                    WHERE re.empresaId = ? AND re.usuarioId = ?
                `, [clienteDestinoEmpresa[0].empresaId, usuarioId]);

                console.log("🔍 [REPLICAR PERFIL] Verificação de permissão para cliente", clienteDestinoId, ":", {
                    empresaId: clienteDestinoEmpresa[0].empresaId,
                    usuarioId,
                    temPermissao: clienteDestino.length > 0
                });

                if (clienteDestino.length === 0) {
                    console.warn(`Cliente destino ${clienteDestinoId} não encontrado ou sem permissão`);
                    continue;
                }

                // Replicar particularidades (respostas das enquetes)
                if (particularidades && Array.isArray(particularidades) && particularidades.length > 0) {
                    // Remover respostas existentes do cliente destino
                    await db.query(
                        "DELETE FROM cliente_respostas WHERE clienteId = ?",
                        [clienteDestinoId]
                    );

                    // Inserir as novas respostas
                    for (const particularidadeId of particularidades) {
                        await db.query(
                            "INSERT INTO cliente_respostas (clienteId, respostaId) VALUES (?, ?)",
                            [clienteDestinoId, particularidadeId]
                        );
                    }
                }

                // Replicar grupos
                if (grupoIds && Array.isArray(grupoIds) && grupoIds.length > 0) {
                    // Remover grupos existentes do cliente destino
                    await db.query(
                        "DELETE FROM clientes_grupos_vinculo WHERE clienteId = ?",
                        [clienteDestinoId]
                    );

                    // Inserir os novos grupos
                    for (const grupoId of grupoIds) {
                        await db.query(
                            "INSERT INTO clientes_grupos_vinculo (clienteId, grupoId) VALUES (?, ?)",
                            [clienteDestinoId, grupoId]
                        );
                    }
                }

                replicados++;
            } catch (error) {
                console.error(`Erro ao replicar para cliente ${clienteDestinoId}:`, error);
                // Continua com o próximo cliente
            }
        }

        res.json({ 
            success: true, 
            message: `Perfil replicado com sucesso para ${replicados} cliente(s)!`,
            replicados
        });
    } catch (error) {
        console.error("❌ Erro ao replicar perfil do cliente:", error);
        res.status(500).json({ error: "Erro ao replicar perfil do cliente." });
    }
};

// 🔹 Certifique-se de que as funções estão sendo exportadas corretamente
module.exports = { 
    cadastrarCliente, 
    listarClientesPorEmpresa, 
    removerClienteDaEmpresa, 
    importarEmpresas, 
    importarEmpresasParaBD, 
    listarDores, 
    listarSolucoes, 
    mapearDoresSolucoes,
    aplicarResponsavelDepartamento,
    buscarParticularidadesCliente,
    replicarPerfilCliente
};