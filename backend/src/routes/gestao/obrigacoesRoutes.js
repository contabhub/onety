const express = require("express");
const router = express.Router();
const verifyToken = require("../../middlewares/auth");
const db = require("../../config/database");
const jwt = require("jsonwebtoken");
const { addDays, subDays, parseISO, isEqual, isBefore, addBusinessDays } = require('date-fns');
const { consultarDCTFWeb } = require("../../services/gestao/dctfwebService"); // Importa a função que já existe
const multer = require("multer");
const xlsx = require("xlsx");
const fs = require("fs");

// Configuração do multer para upload de arquivos
const upload = multer({ dest: "uploads/" });

// ================= FUNÇÕES AUXILIARES =================

// Função para converter diaSemana (nome do mês) para número do mês
function obterMesDoDiaSemana(diaSemana) {
  if (!diaSemana) return null;
  
  const mesesMap = {
    'Janeiro': 1, 'Fevereiro': 2, 'Março': 3, 'Marco': 3, 'Abril': 4, 'Maio': 5, 'Junho': 6,
    'Julho': 7, 'Agosto': 8, 'Setembro': 9, 'Outubro': 10, 'Novembro': 11, 'Dezembro': 12
  };
  
  return mesesMap[diaSemana] || null;
}

// Função para subtrair dias (úteis ou corridos)
function subtrairDias(dataBase, qtd, tipo) {
  let data = new Date(dataBase);
  if (!qtd) return data;
  if (typeof tipo === 'string' && tipo.toLowerCase().includes('corrid')) {
    data.setDate(data.getDate() - qtd);
    return data;
  }
  // Dias úteis: subtrai pulando fim de semana
  let count = 0;
  while (count < qtd) {
    data.setDate(data.getDate() - 1);
    if (data.getDay() !== 0 && data.getDay() !== 6) {
      count++;
    }
  }
  return data;
}

// ================= AÇÕES EM LOTE =================

// 🔶 GET /api/obrigacoes/setores - Listar setores únicos das obrigações
router.get("/setores", verifyToken, async (req, res) => {
  try {
    const empresaId = req.usuario?.empresaId;
    if (!empresaId) {
      return res.status(400).json({ error: "Empresa ID é obrigatório." });
    }

    const [setores] = await db.query(`
      SELECT DISTINCT d.nome as setor
      FROM obrigacoes o
      LEFT JOIN departamentos d ON o.departamento_id = d.id
      WHERE o.empresa_id = ? AND d.nome IS NOT NULL
      ORDER BY d.nome ASC
    `, [empresaId]);

    const setoresList = setores.map(row => row.setor);
    res.json(setoresList);
  } catch (err) {
    console.error("Erro ao buscar setores:", err);
    res.status(500).json({ error: "Erro ao buscar setores." });
  }
});

// 🔶 ROTA EM LOTE: Buscar obrigações base (tabela 'obrigacoes') para todos os clientes de um grupo
// Exemplo: GET /api/obrigacoes/cliente/lote?grupoId=123
  router.get('/cliente/lote', verifyToken, async (req, res) => {
    try {
      const { grupoId, apenasSemlResponsavel = 'false' } = req.query;
      if (!grupoId) {
        return res.status(400).json({ error: 'grupoId é obrigatório' });
      }

    // 1) Buscar todos os clientes vinculados ao grupo
    const [clientesGrupo] = await db.query(
      'SELECT cliente_id FROM clientes_grupos_vinculo WHERE grupo_id = ?',[grupoId]
    );
    const clienteIds = clientesGrupo.map(c => c.cliente_id);
    if (clienteIds.length === 0) {
      return res.json({ resultado: [] });
    }

    // 2) Buscar respostas (particularidades) de TODOS OS clientes de uma vez
    const placeholders = clienteIds.map(() => '?').join(',');
    const [respostasRows] = await db.query(`
      SELECT cr.cliente_id, r.particularidade_id
      FROM cliente_respostas cr
      JOIN enquete_respostas r ON cr.resposta_id = r.id
      WHERE cr.cliente_id IN (${placeholders})
    `, clienteIds);

    // 3) Buscar responsáveis fixos (por cliente) e globais
    const [respClienteRows] = await db.query(`
      SELECT orc.obrigacao_id, orc.cliente_id, u.id as usuarioId, u.nome AS responsavel_nome
      FROM obrigacoes_responsaveis_cliente orc
      JOIN usuarios u ON u.id = orc.usuario_id
      WHERE orc.cliente_id IN (${placeholders})
    `, clienteIds);

    const [respGlobalRows] = await db.query(`
      SELECT orc.obrigacao_id, u.id as usuarioId, u.nome AS responsavel_nome
      FROM obrigacoes_responsaveis_cliente orc
      JOIN usuarios u ON u.id = orc.usuario_id
      WHERE orc.cliente_id IS NULL
    `);

    // Mapas de responsáveis (múltiplos)
    const respClienteArrayMap = new Map(); // key: `${clienteId}:${obrigacaoId}` -> [{usuarioId, nome}, ...]
    for (const row of respClienteRows) {
      const key = `${row.cliente_id}:${row.obrigacao_id}`;
      if (!respClienteArrayMap.has(key)) respClienteArrayMap.set(key, []);
      respClienteArrayMap.get(key).push({ usuarioId: row.usuarioId, nome: row.responsavel_nome });
    }
    const respGlobalArrayMap = new Map(); // key: obrigacaoId -> [{usuarioId, nome}, ...]
    for (const row of respGlobalRows) {
      if (!respGlobalArrayMap.has(row.obrigacao_id)) respGlobalArrayMap.set(row.obrigacao_id, []);
      respGlobalArrayMap.get(row.obrigacao_id).push({ usuarioId: row.usuarioId, nome: row.responsavel_nome });
    }

    // Mapa: clienteId -> [particularidadeId, ...]
    const clienteIdToParticularidades = new Map();
    for (const cid of clienteIds) clienteIdToParticularidades.set(cid, []);
    for (const row of respostasRows) {
      if (!clienteIdToParticularidades.has(row.cliente_id)) {
        clienteIdToParticularidades.set(row.cliente_id, []);
      }
      clienteIdToParticularidades.get(row.cliente_id).push(row.particularidade_id);
    }

    // 4) Buscar TODAS as obrigações e suas particularidades (uma vez só)
    const [obrigacoesRows] = await db.query(`
      SELECT 
        o.*, 
        d.nome as departamentoNome,
        op.tipo as tipoPart,
        op.particularidade_id
      FROM obrigacoes o
      JOIN departamentos d ON o.departamento_id = d.id
      JOIN obrigacoes_particularidades op ON op.obrigacao_id = o.id
    `);

    // Agrupar particularidades por obrigação, como na rota individual
    const obrigacoesMap = new Map();
    for (const row of obrigacoesRows) {
      if (!obrigacoesMap.has(row.id)) {
        obrigacoesMap.set(row.id, {
          ...row,
          obrigacaoId: row.id,
          particularidadesE: [],
          particularidadesOU: [],
          particularidadesEXCETO: []
        });
      }
      const ob = obrigacoesMap.get(row.id);
      if (row.tipoPart === 'E') ob.particularidadesE.push(row.particularidade_id);
      else if (row.tipoPart === 'OU') ob.particularidadesOU.push(row.particularidade_id);
      else if (row.tipoPart === 'EXCETO') ob.particularidadesEXCETO.push(row.particularidade_id);
    }
    const obrigacoesBase = Array.from(obrigacoesMap.values());

    // 5) Para cada cliente, aplicar a mesma regra de match e anexar responsável (cliente > global)
    const resultado = [];
          for (const clienteId of clienteIds) {
        const particularidadesCliente = clienteIdToParticularidades.get(clienteId) || [];
        let listaValidas = obrigacoesBase.filter(o => {
          const temTodasE = o.particularidadesE.every(p => particularidadesCliente.includes(p));
          const temAlgumaOU = o.particularidadesOU.length === 0 || o.particularidadesOU.some(p => particularidadesCliente.includes(p));
          const temAlgumExceto = o.particularidadesEXCETO.length > 0 && o.particularidadesEXCETO.some(p => particularidadesCliente.includes(p));
          return temTodasE && temAlgumaOU && !temAlgumExceto;
        }).map(o => {
          const individuais = respClienteArrayMap.get(`${clienteId}:${o.obrigacaoId}`) || [];
          const globais = respGlobalArrayMap.get(o.obrigacaoId) || [];
          const resumo = (individuais[0]?.nome) || (globais[0]?.nome) || null;
          return {
            ...o,
            responsaveisIndividuais: individuais,
            responsaveisGlobais: globais,
            responsavel_nome: resumo,
          };
        });

        // Filtrar apenas obrigações sem responsáveis se solicitado
        if (apenasSemlResponsavel === 'true') {
          listaValidas = listaValidas.filter(o => 
            o.responsaveisIndividuais.length === 0 && o.responsaveisGlobais.length === 0
          );
        }

        // Só adicionar clientes que têm obrigações após o filtro
        if (apenasSemlResponsavel === 'true') {
          // Se o filtro está ativo, só incluir clientes com obrigações pendentes
          if (listaValidas.length > 0) {
            resultado.push({ clienteId, obrigacoes: listaValidas });
          }
        } else {
          // Se o filtro não está ativo, incluir todos os clientes
          resultado.push({ clienteId, obrigacoes: listaValidas });
        }
      }

    res.json({ resultado });
  } catch (err) {
    console.error('Erro em /api/obrigacoes/cliente/lote:', err);
    res.status(500).json({ error: 'Erro ao buscar obrigações em lote por grupo' });
  }
});

// 🔶 GET /api/obrigacoes?empresaId=X&grupoId=Y - Buscar obrigações por grupo
router.get("/", verifyToken, async (req, res) => {
  try {
    const { empresaId, grupoId } = req.query;
    
    if (!empresaId) {
      return res.status(400).json({ error: "Empresa ID é obrigatório." });
    }

    let query = `
      SELECT 
        oc.id,
        oc.nome as descricao,
        oc.status,
        d.nome as setor,
        u.nome as responsavel_nome,
        oc.cliente_id AS clienteId,
        c.nome as cliente_nome
      FROM obrigacoes_clientes oc
      JOIN obrigacoes o ON oc.obrigacao_id = o.id
      LEFT JOIN departamentos d ON o.departamento_id = d.id
      LEFT JOIN usuarios u ON oc.responsavel_id = u.id
      LEFT JOIN clientes c ON oc.cliente_id = c.id
      WHERE o.empresa_id = ?
    `;
    
    const params = [empresaId];

    // Se grupoId for fornecido, filtrar por grupo
    if (grupoId) {
      query += ` AND oc.cliente_id IN (
        SELECT cgv.cliente_id 
        FROM clientes_grupos_vinculo cgv 
        WHERE cgv.grupo_id = ?
      )`;
      params.push(grupoId);
    }

    query += ` ORDER BY d.nome, oc.nome`;

    const [obrigacoes] = await db.query(query, params);
    
    res.json({ obrigacoes });
  } catch (err) {
    console.error("Erro ao buscar obrigações:", err);
    res.status(500).json({ error: "Erro ao buscar obrigações." });
  }
});

// 🔶 POST /api/obrigacoes/definir-responsavel-lote - Aplicar responsável em lote
router.post("/definir-responsavel-lote", verifyToken, async (req, res) => {
  try {
    const { empresaId, grupoId, setor, responsavelId, selectedClients, selectedPairs } = req.body;
    
    if (!empresaId || !grupoId || !setor || !responsavelId) {
      return res.status(400).json({ 
        error: "Todos os campos são obrigatórios: empresaId, grupoId, setor, responsavelId" 
      });
    }

    // Verificar se o responsável existe e pertence à empresa
    const [responsavel] = await db.query(`
      SELECT u.id, u.nome 
      FROM usuarios u
      INNER JOIN relacao_empresas re ON u.id = re.usuarioId
      WHERE u.id = ? AND re.empresaId = ?
    `, [responsavelId, empresaId]);

    if (!responsavel.length) {
      return res.status(404).json({ error: "Responsável não encontrado ou não pertence à empresa." });
    }

    // Buscar obrigações da empresa no setor especificado
    let query = `
      SELECT o.id as obrigacaoId, o.nome as obrigacaoNome, d.nome as departamentoNome
      FROM obrigacoes o
      LEFT JOIN departamentos d ON o.departamentoId = d.id
      WHERE o.empresaId = ?
    `;
    const params = [empresaId];

    // Adicionar filtro de setor se especificado
    if (setor && setor !== 'Todos') {
      query += ` AND d.nome = ?`;
      params.push(setor);
    }

    // Buscar obrigações do setor
    const [obrigacoes] = await db.query(query, params);

    if (!obrigacoes.length) {
      return res.status(404).json({ 
        error: "Nenhuma obrigação encontrada no setor especificado." 
      });
    }

    // Buscar clientes do grupo
    const [clientesGrupo] = await db.query(`
      SELECT cgv.clienteId 
      FROM clientes_grupos_vinculo cgv 
      WHERE cgv.grupoId = ?
    `, [grupoId]);

    if (!clientesGrupo.length) {
      return res.status(404).json({ 
        error: "Nenhum cliente encontrado no grupo especificado." 
      });
    }

    // Filtrar clientes se especificado
    const validSelectedClients = Array.isArray(selectedClients) && selectedClients.length > 0
      ? selectedClients.filter((v) => Number.isFinite(Number(v))).map((v) => Number(v))
      : [];

    let clientesAlvo = clientesGrupo.map(c => c.clienteId);
    if (validSelectedClients.length > 0) {
      clientesAlvo = clientesAlvo.filter(id => validSelectedClients.includes(id));
    }

    // Filtrar por pares específicos se especificado
    const validSelectedPairs = Array.isArray(selectedPairs) && selectedPairs.length > 0
      ? selectedPairs
      : [];

    let paresObrigacaoCliente = [];
    
    if (validSelectedPairs.length > 0) {
      // Usar apenas os pares especificados
      for (const p of validSelectedPairs) {
        if (typeof p === 'string' && p.includes(':')) {
          const [c, o] = p.split(':');
          const cid = Number(c);
          const oid = Number(o);
          if (Number.isFinite(cid) && Number.isFinite(oid)) {
            // Verificar se a obrigação está nas obrigações encontradas
            const obrigacaoExiste = obrigacoes.find(ob => ob.obrigacaoId === oid);
            if (obrigacaoExiste && clientesAlvo.includes(cid)) {
              paresObrigacaoCliente.push({ clienteId: cid, obrigacaoId: oid });
            }
          }
        }
      }
    } else {
      // Criar combinações de todas as obrigações com todos os clientes
      for (const obrigacao of obrigacoes) {
        for (const clienteId of clientesAlvo) {
          paresObrigacaoCliente.push({ 
            clienteId: clienteId, 
            obrigacaoId: obrigacao.obrigacaoId 
          });
        }
      }
    }

    if (!paresObrigacaoCliente.length) {
      return res.status(404).json({ 
        error: "Nenhuma combinação válida de cliente/obrigação encontrada." 
      });
    }

    // Debug: Log do que será processado
    console.log("🔍 Debug - Obrigações encontradas:", obrigacoes.length);
    console.log("🔍 Debug - Clientes alvo:", clientesAlvo.length);
    console.log("🔍 Debug - Pares a processar:", paresObrigacaoCliente.length);

    // Aplicar responsável em lote usando INSERT ... ON DUPLICATE KEY UPDATE
    const valuesPlaceholders = paresObrigacaoCliente.map(() => '(?, ?, ?)').join(', ');
    const values = [];
    
    for (const par of paresObrigacaoCliente) {
      values.push(par.obrigacaoId, par.clienteId, responsavelId);
    }

    await db.query(`
      INSERT INTO obrigacoes_responsaveis_cliente (obrigacao_id, cliente_id, usuario_id)
      VALUES ${valuesPlaceholders}
      ON DUPLICATE KEY UPDATE usuario_id = VALUES(usuario_id)
    `, values);

    res.json({ 
      success: true, 
      message: `Responsável ${responsavel[0].nome} definido para ${paresObrigacaoCliente.length} combinações cliente/obrigação do setor ${setor}`,
      obrigacoesAtualizadas: paresObrigacaoCliente.length,
      detalhes: {
        obrigacoes: obrigacoes.length,
        clientes: clientesAlvo.length,
        combinacoes: paresObrigacaoCliente.length
      }
    });

  } catch (err) {
    console.error("Erro ao definir responsável em lote:", err);
    res.status(500).json({ error: "Erro ao definir responsável em lote." });
  }
});

// 🔶 Buscar obrigações para gerar tarefas por cliente
router.get("/para-gerar-tarefas", verifyToken, async (req, res) => {
  const { clienteId, ano, apenasAptas, departamentoId } = req.query;



  try {
    // 1. Buscar respostas do cliente
    const [respostas] = await db.query(`
      SELECT r.particularidade_id
      FROM cliente_respostas cr
      JOIN enquete_respostas r ON cr.resposta_id = r.id
      WHERE cr.cliente_id = ?
    `, [clienteId]);
    const particularidadesCliente = respostas.map(r => r.particularidade_id);

    // 2. Buscar obrigações com suas particularidades
    let query = `
      SELECT DISTINCT
        o.*, 
        d.nome as departamentoNome,
        op.tipo as tipoPart,
        op.particularidadeId,
        orc.usuarioId as responsavelId,
        u.nome as responsavelNome
      FROM obrigacoes o
      JOIN departamentos d ON o.departamentoId = d.id
      JOIN obrigacoes_particularidades op ON op.obrigacaoId = o.id
      JOIN empresas e ON o.empresaId = e.id
      JOIN clientes c ON c.empresaId = e.id AND c.id = ?
      LEFT JOIN obrigacoes_responsaveis_cliente orc ON orc.obrigacaoId = o.id AND orc.clienteId = ?
      LEFT JOIN usuarios u ON u.id = orc.usuarioId
      WHERE c.id = ?
    `;
    
    const params = [clienteId, clienteId, clienteId];

    if (departamentoId && departamentoId !== "Todos") {
      query += " AND o.departamentoId = ?";
      params.push(parseInt(departamentoId));
    }



    const [obrigacoes] = await db.query(query, params);
    


    // 3. Agrupar particularidades por obrigação
    const obrigacoesMap = {};

    for (const row of obrigacoes) {
      if (!obrigacoesMap[row.id]) {
        obrigacoesMap[row.id] = {
          ...row,
          obrigacaoId: row.id,
          particularidadesE: [],
          particularidadesOU: [],
          particularidadesEXCETO: []
        };
      }

      if (row.tipoPart === "E") {
        obrigacoesMap[row.id].particularidadesE.push(row.particularidadeId);
      } else if (row.tipoPart === "OU") {
        obrigacoesMap[row.id].particularidadesOU.push(row.particularidadeId);
      } else if (row.tipoPart === "EXCETO") {
        obrigacoesMap[row.id].particularidadesEXCETO.push(row.particularidadeId);
      }
    }

    // 4. Validar match para cada obrigação
    let obrigacoesValidas = Object.values(obrigacoesMap).filter(o => {
      const temTodasE = o.particularidadesE.every(p => particularidadesCliente.includes(p));
      const temAlgumaOU = o.particularidadesOU.length === 0 || o.particularidadesOU.some(p => particularidadesCliente.includes(p));
      const temAlgumExceto = o.particularidadesEXCETO.length > 0 && o.particularidadesEXCETO.some(p => particularidadesCliente.includes(p));
      return temTodasE && temAlgumaOU && !temAlgumExceto;
    });

    // 5. Filtrar por obrigações aptas se solicitado
    if (apenasAptas === "true") {
      const obrigacoesAptas = [];
      
      for (const obrigacao of obrigacoesValidas) {
        // Verificar se já existe obrigação gerada para este cliente/ano
        const [existentes] = await db.query(`
          SELECT id FROM obrigacoes_clientes 
          WHERE cliente_id = ? AND obrigacao_id = ? AND ano_referencia = ?
        `, [clienteId, obrigacao.id, ano]);
        
        if (existentes.length === 0) {
          obrigacoesAptas.push(obrigacao);
        }
      }
      
      obrigacoesValidas = obrigacoesAptas;
    }



    res.json(obrigacoesValidas);
  } catch (err) {
    console.error("Erro ao buscar obrigações para gerar tarefas:", err);
    res.status(500).json({ error: "Erro ao buscar obrigações." });
  }
});

/**
 * GET /api/obrigacoes/buscar-avancada
 * Busca avançada para ações em lote
 */
router.get("/buscar-avancada", verifyToken, async (req, res) => {
  try {
    const {
      empresaId,
      tipoTarefa,
      departamento,
      status,
      data,
      periodoInicial,
      periodoFinal,
      cliente,
      tipoUsuario,
      usuario,
      time,
      grupo,
      obrigacoes,
      responsavelExclusivo,
      frequencia,
      publicacao,
      comUltimoAndamento,
      comAtividades,
      comResponsaveis,
      comConvidados
    } = req.query;

    // NOVO: Se tipoTarefa === 'tarefas', buscar na tabela de tarefas
    if (tipoTarefa === "tarefas") {
      let whereClause = "WHERE t.empresaId = ?";
      const params = [empresaId];

      if (departamento) {
        whereClause += " AND t.departamentoId = ?";
        params.push(departamento);
      }
      if (status) {
        whereClause += " AND t.status = ?";
        params.push(status);
      }
      if (cliente) {
        whereClause += " AND t.clienteId = ?";
        params.push(cliente);
      }
      if (usuario) {
        whereClause += " AND t.responsavelId = ?";
        params.push(usuario);
      }
      if (periodoInicial && data) {
        whereClause += ` AND t.${data} >= ?`;
        params.push(periodoInicial);
      }
      if (periodoFinal && data) {
        whereClause += ` AND t.${data} <= ?`;
        params.push(periodoFinal);
      }
      // Outros filtros podem ser adicionados conforme necessário

      const [tarefas] = await db.query(
        `SELECT t.*, d.nome as departamentoNome, u.nome as responsavelNome, c.nome as cliente_nome
         FROM tarefas t
         LEFT JOIN departamentos d ON t.departamentoId = d.id
         LEFT JOIN usuarios u ON t.responsavelId = u.id
         LEFT JOIN clientes c ON t.clienteId = c.id
         ${whereClause}
         ORDER BY t.dataPrazo DESC`,
        params
      );
      return res.json(tarefas);
    }

    let whereClause = "WHERE 1=1";
    const params = [];

    // Filtros básicos
    if (empresaId) {
      whereClause += " AND o.empresaId = ?";
      params.push(empresaId);
    }

    if (departamento) {
      // Verificar se é um ID numérico ou nome
      if (/^\d+$/.test(departamento)) {
        // É um ID numérico
        whereClause += " AND d.id = ?";
        params.push(parseInt(departamento));
      } else {
        // É um nome, fazer busca LIKE
        whereClause += " AND d.nome LIKE ?";
        params.push(`%${departamento}%`);
      }
    }

    if (status) {
      whereClause += " AND oc.status = ?";
      params.push(status);
    }

    if (cliente) {
      // Verificar se é um ID numérico ou nome
      if (/^\d+$/.test(cliente)) {
        // É um ID numérico
        whereClause += " AND c.id = ?";
        params.push(parseInt(cliente));
      } else {
        // É um nome, fazer busca LIKE
        whereClause += " AND c.nome LIKE ?";
        params.push(`%${cliente}%`);
      }
    }

    if (obrigacoes) {
      // Verificar se é um ID numérico ou nome
      if (/^\d+$/.test(obrigacoes)) {
        // É um ID numérico
        whereClause += " AND o.id = ?";
        params.push(parseInt(obrigacoes));
      } else {
        // É um nome, fazer busca LIKE
        whereClause += " AND o.nome LIKE ?";
        params.push(`%${obrigacoes}%`);
      }
    }

    if (frequencia) {
      whereClause += " AND o.frequencia = ?";
      params.push(frequencia);
    }

    // Filtros de data
    if (periodoInicial && data) {
      whereClause += ` AND oc.${data} >= ?`;
      params.push(periodoInicial);
    }

    if (periodoFinal && data) {
      whereClause += ` AND oc.${data} <= ?`;
      params.push(periodoFinal);
    }

    // Filtros de usuário
    if (usuario) {
      whereClause += " AND oc.responsavelId = ?";
      params.push(usuario);
    }

    if (responsavelExclusivo) {
      whereClause += " AND oc.responsavelId = ?";
      params.push(responsavelExclusivo);
    }

    // Filtro por grupo de clientes
    if (grupo) {
      console.log(`🔍 Aplicando filtro por grupo: ${grupo}`);
      whereClause += ` AND EXISTS (
        SELECT 1 FROM clientes_grupos_vinculo cgv 
        WHERE cgv.cliente_id = c.id AND cgv.grupo_id = ?
      )`;
      params.push(parseInt(grupo));
    }

    // Filtros booleanos
    if (comUltimoAndamento === "true") {
      whereClause += " AND oc.ultimoAndamento IS NOT NULL";
    }

    if (comAtividades === "true") {
      whereClause += " AND EXISTS (SELECT 1 FROM obrigacoes_atividades_clientes oac WHERE oac.obrigacao_cliente_id = oc.id)";
    }

    if (comResponsaveis === "true") {
      whereClause += " AND oc.responsavelId IS NOT NULL";
    }

    if (comConvidados === "true") {
      whereClause += " AND EXISTS (SELECT 1 FROM convidados_obrigacao co WHERE co.obrigacao_cliente_id = oc.id)";
    }

    const query = `
      SELECT 
        oc.id,
        oc.status,
        oc.acao,
        oc.meta,
        oc.vencimento,
        oc.dataBaixa,
        o.nome AS obrigacaoNome,
        o.frequencia,
        o.acaoQtdDias,
        o.metaQtdDias,
        o.vencimentoDia,
        d.nome AS departamentoNome,
        c.nome AS clienteNome,
        c.cnpjCpf AS clienteCnpj,
        u.nome AS responsavelNome
      FROM obrigacoes_clientes oc
      JOIN obrigacoes o ON o.id = oc.obrigacao_id
      JOIN departamentos d ON d.id = o.departamento_id
      JOIN clientes c ON c.id = oc.cliente_id
      LEFT JOIN usuarios u ON u.id = oc.responsavel_id
      ${whereClause}
      ORDER BY oc.vencimento ASC
    `;

    console.log(`🔍 Query final: ${query}`);
    console.log(`🔍 Parâmetros: ${JSON.stringify(params)}`);

    const [rows] = await db.execute(query, params);
    res.json(rows);
  } catch (error) {
    console.error("Erro na busca avançada:", error);
    res.status(500).json({ error: "Erro interno na busca avançada" });
  }
});

/**
 * POST /api/obrigacoes/buscar-por-filtros
 * Busca obrigações por filtros específicos para prorrogação
 * 
 * Parâmetros esperados:
 * - competenciaInicial: { ano: number, mes: number } - Ex: { ano: 2024, mes: 1 }
 * - competenciaFinal: { ano: number, mes: number } - Ex: { ano: 2024, mes: 12 }
 */
router.post("/buscar-por-filtros", verifyToken, async (req, res) => {
  try {
          const {
        empresaId,
        tipoTarefa,
        departamento,
        status,
        obrigacaoId,
        clienteId,
        competenciaInicial,
        competenciaFinal,
        competenciaExata
      } = req.body;

    if (!empresaId) {
      return res.status(400).json({ error: "Empresa ID é obrigatório" });
    }

    let whereClause = "WHERE o.empresaId = ?";
    const params = [empresaId];

    // Filtro por departamento
    if (departamento) {
      whereClause += " AND d.nome = ?";
      params.push(departamento);
    }

    // Filtro por status (se aplicável)
    if (status) {
      whereClause += " AND oc.status = ?";
      params.push(status);
    }

    // Filtro por obrigação específica
    if (obrigacaoId && obrigacaoId !== "todas") {
      whereClause += " AND o.id = ?";
      params.push(parseInt(obrigacaoId));
    }

    // Filtro por cliente
    if (clienteId) {
      whereClause += " AND c.id = ?";
      params.push(parseInt(clienteId));
    }

    // Filtro por competência exata (mesmo mês e ano)
    if (competenciaExata) {
      whereClause += " AND oc.ano_referencia = ? AND oc.mes_referencia = ?";
      params.push(competenciaExata.ano, competenciaExata.mes);
    } else {
      // Filtro por competência inicial (ano + mês de referência)
      if (competenciaInicial) {
        whereClause += " AND (oc.ano_referencia > ? OR (oc.ano_referencia = ? AND oc.mes_referencia >= ?))";
        params.push(competenciaInicial.ano, competenciaInicial.ano, competenciaInicial.mes);
      }

      // Filtro por competência final (ano + mês de referência)
      if (competenciaFinal) {
        whereClause += " AND (oc.ano_referencia < ? OR (oc.ano_referencia = ? AND oc.mes_referencia <= ?))";
        params.push(competenciaFinal.ano, competenciaFinal.ano, competenciaFinal.mes);
      }
    }

    const query = `
      SELECT 
        oc.id,
        oc.status,
        oc.acao,
        oc.meta,
        oc.vencimento,
        oc.mes_referencia,
        oc.ano_referencia,
        oc.dataBaixa,
        o.id as obrigacaoId,
        o.nome as nome,
        o.frequencia,
        o.acaoQtdDias,
        o.metaQtdDias,
        o.vencimentoDia,
        o.fatoGerador,
        o.orgao,
        d.id as departamentoId,
        d.nome as departamentoNome,
        c.id as clienteId,
        c.nome as clienteNome,
        c.cnpjCpf as clienteDocumento,
        u.id as responsavelId,
        u.nome as responsavelNome
      FROM obrigacoes_clientes oc
      JOIN obrigacoes o ON o.id = oc.obrigacaoId
      JOIN departamentos d ON d.id = o.departamentoId
      JOIN clientes c ON c.id = oc.clienteId
      LEFT JOIN usuarios u ON u.id = oc.responsavelId
      ${whereClause}
      ORDER BY oc.vencimento ASC
    `;

    const [rows] = await db.execute(query, params);
    res.json(rows);
  } catch (error) {
    console.error("Erro na busca por filtros:", error);
    res.status(500).json({ error: "Erro interno na busca por filtros" });
  }
});


/**
 * GET /api/obrigacoes/variaveis-disponiveis
 * Retorna lista de variáveis disponíveis para templates
 */
router.get('/variaveis-disponiveis', verifyToken, async (req, res) => {
  const variaveis = {
    // Variáveis para o assunto (dropdown simples)
    assunto: {
      'empresa.apelido': 'Apelido da empresa',
      'cliente.apelido': 'Apelido do cliente', 
      'cliente.nome': 'Nome do cliente',
      'obrigacao.nome': 'Nome da obrigação',
      'tarefa.competencia': 'Competência da tarefa',
      'tarefa.vencimento': 'Vencimento da tarefa'
    },
    // Variáveis completas para o corpo do e-mail
    cliente: {
      'cliente.nome': 'Nome do cliente',
      'cliente.cnpjCpf': 'CNPJ/CPF do cliente',
      'cliente.email': 'E-mail do cliente',
      'cliente.telefone': 'Telefone do cliente',
      'cliente.endereco': 'Endereço do cliente',
      'cliente.apelido': 'Apelido do cliente'
    },
    obrigacao: {
      'obrigacao.nome': 'Nome da obrigação',
      'obrigacao.departamento': 'Departamento da obrigação',
      'obrigacao.vencimento': 'Data de vencimento',
      'obrigacao.descricao': 'Descrição da obrigação'
    },
    tarefa: {
      'tarefa.competencia': 'Competência da tarefa',
      'tarefa.vencimento': 'Vencimento da tarefa',
      'tarefa.descricao': 'Descrição da tarefa'
    },
    competencia: {
      'competencia.mes': 'Mês de referência (ex: Janeiro)',
      'competencia.ano': 'Ano de referência',
      'competencia.mesAno': 'Mês/Ano (ex: JAN/2024)',
      'competencia.mesNumero': 'Número do mês (ex: 01)'
    },
    responsavel: {
      'responsavel.nome': 'Nome do responsável',
      'responsavel.email': 'E-mail do responsável',
      'responsavel.telefone': 'Telefone do responsável'
    },
    datas: {
      'datas.meta': 'Data meta calculada',
      'datas.acao': 'Data ação calculada',
      'datas.vencimento': 'Data de vencimento formatada',
      'datas.hoje': 'Data atual'
    },
    empresa: {
      'empresa.nome': 'Nome da empresa',
      'empresa.cnpj': 'CNPJ da empresa',
      'empresa.razaoSocial': 'Razão social da empresa',
      'empresa.apelido': 'Apelido da empresa'
    }
  };
  
  res.json(variaveis);
});

/**
 * POST /api/obrigacoes/processar-template/:obrigacaoClienteId/:atividadeId
 * Processa template de e-mail com variáveis reais
 */
router.post('/processar-template/:obrigacaoClienteId/:atividadeId', verifyToken, async (req, res) => {
  const { obrigacaoClienteId, atividadeId } = req.params;
  
  try {
    // Buscar template
    const [[template]] = await db.query(`
      SELECT * FROM obrigacoes_email_templates WHERE atividadeId = ?
    `, [atividadeId]);
    
    if (!template) {
      return res.status(404).json({ error: 'Template não encontrado.' });
    }
    
    // Buscar dados da obrigação
    const [[obrigacao]] = await db.query(`
      SELECT 
        oc.*, c.nome as clienteNome, c.cnpjCpf as clienteCnpj, c.email as clienteEmail,
        o.nome as obrigacaoNome, o.metaQtdDias, o.metaTipoDias, o.acaoQtdDias, o.acaoTipoDias,
        d.nome as departamentoNome, u.nome as responsavelNome, u.email as responsavelEmail,
        e.razaoSocial as empresaNome, e.cnpj as empresaCnpj
      FROM obrigacoes_clientes oc
      JOIN clientes c ON oc.cliente_id = c.id
      JOIN obrigacoes o ON oc.obrigacao_id = o.id
      JOIN departamentos d ON o.departamento_id = d.id
      JOIN empresas e ON c.empresa_id = e.id
      LEFT JOIN usuarios u ON oc.responsavel_id = u.id
      WHERE oc.id = ?
    `, [obrigacaoClienteId]);
    
    if (!obrigacao) {
      return res.status(404).json({ error: 'Obrigação não encontrada.' });
    }
    
    // Calcular datas
    const vencimento = new Date(obrigacao.vencimento);
    const meta = obrigacao.metaQtdDias ? subtrairDias(vencimento, obrigacao.metaQtdDias, obrigacao.metaTipoDias) : null;
    const acao = meta && obrigacao.acaoQtdDias ? subtrairDias(meta, obrigacao.acaoQtdDias, obrigacao.acaoTipoDias) : null;
    
    // ✅ Mapear apenas as variáveis que estão no template
    const variaveisTemplate = template.variaveis ? JSON.parse(template.variaveis) : {};
    const variaveis = {};
    
    // Processar apenas as variáveis que estão no template
    for (const categoria in variaveisTemplate) {
      for (const variavel in variaveisTemplate[categoria]) {
        // Mapear valores reais baseado no tipo de variável
        switch (variavel) {
          case 'cliente.nome':
            variaveis[variavel] = obrigacao.clienteNome;
            break;
          case 'cliente.cnpjCpf':
            variaveis[variavel] = obrigacao.clienteCnpj;
            break;
          case 'cliente.email':
            variaveis[variavel] = obrigacao.clienteEmail;
            break;
          case 'obrigacao.nome':
            variaveis[variavel] = obrigacao.obrigacaoNome;
            break;
          case 'obrigacao.departamento':
            variaveis[variavel] = obrigacao.departamentoNome;
            break;
          case 'obrigacao.vencimento':
            variaveis[variavel] = formatarData(obrigacao.vencimento);
            break;
          case 'tarefa.competencia':
            variaveis[variavel] = `${String(obrigacao.mes_referencia).padStart(2, '0')}/${obrigacao.ano_referencia}`;
            break;
          case 'tarefa.vencimento':
            variaveis[variavel] = formatarData(obrigacao.vencimento);
            break;
          case 'competencia.mes':
            variaveis[variavel] = getMesNome(obrigacao.mes_referencia);
            break;
          case 'competencia.ano':
            variaveis[variavel] = obrigacao.ano_referencia;
            break;
          case 'competencia.mesAno':
            variaveis[variavel] = `${getMesAbrev(obrigacao.mes_referencia)}/${obrigacao.ano_referencia}`;
            break;
          case 'competencia.mesNumero':
            variaveis[variavel] = String(obrigacao.mes_referencia).padStart(2, '0');
            break;
          case 'responsavel.nome':
            variaveis[variavel] = obrigacao.responsavelNome || 'Não definido';
            break;
          case 'responsavel.email':
            variaveis[variavel] = obrigacao.responsavelEmail || '';
            break;
          case 'datas.meta':
            variaveis[variavel] = meta ? formatarData(meta) : 'Não calculada';
            break;
          case 'datas.acao':
            variaveis[variavel] = acao ? formatarData(acao) : 'Não calculada';
            break;
          case 'datas.vencimento':
            variaveis[variavel] = formatarData(obrigacao.vencimento);
            break;
          case 'datas.hoje':
            variaveis[variavel] = formatarData(new Date());
            break;
          case 'empresa.nome':
            variaveis[variavel] = obrigacao.empresaNome;
            break;
          case 'empresa.cnpj':
            variaveis[variavel] = obrigacao.empresaCnpj;
            break;
          case 'empresa.razaoSocial':
            variaveis[variavel] = obrigacao.empresaNome;
            break;
          default:
            // Para variáveis não mapeadas, usar valor padrão
            variaveis[variavel] = `[${variavel}]`;
            break;
        }
      }
    }
    
    // Processar template
    let assuntoProcessado = template.assunto;
    let corpoProcessado = template.corpo;
    let destinatarioProcessado = template.destinatario;
    
    // ✅ Log das variáveis que estão sendo processadas
    console.log('🔍 Variáveis do template:', Object.keys(variaveisTemplate));
    console.log('📦 Variáveis mapeadas:', Object.keys(variaveis));
    
    // ✅ Função para substituir variáveis preservando formatação HTML
    const substituirVariaveisPreservandoHTML = (html, variaveis) => {
      if (!html) return html;
      
      let resultado = html;
      
      Object.entries(variaveis).forEach(([variavel, valor]) => {
        // Regex simples que substitui a variável
        const regex = new RegExp(`\\[${variavel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\]`, 'g');
        resultado = resultado.replace(regex, valor || '');
      });
      
      return resultado;
    };
    
    // ✅ Substituir variáveis preservando formatação HTML
    assuntoProcessado = substituirVariaveisPreservandoHTML(template.assunto, variaveis);
    corpoProcessado = substituirVariaveisPreservandoHTML(template.corpo, variaveis);
    destinatarioProcessado = substituirVariaveisPreservandoHTML(template.destinatario, variaveis);
    
    // ✅ Log para debug da formatação HTML
    console.log('🔍 [DEBUG] Corpo original:', template.corpo?.substring(0, 200));
    console.log('🔍 [DEBUG] Corpo processado:', corpoProcessado?.substring(0, 200));
    
    res.json({
      assunto: assuntoProcessado,
      corpo: corpoProcessado,
      destinatario: destinatarioProcessado,
      cc: template.cc,
      co: template.co,
      variaveis
    });
    
  } catch (err) {
    console.error('Erro ao processar template:', err);
    res.status(500).json({ error: 'Erro ao processar template.' });
  }
});

// Funções auxiliares para formatação
function formatarData(data) {
  if (!data) return '';
  const d = new Date(data);
  return d.toLocaleDateString('pt-BR');
}

// ✅ Função para extrair variáveis de um texto
function extrairVariaveis(texto) {
  if (!texto) return [];
  const regex = /\[([^\]]+)\]/g;
  const variaveis = [];
  let match;
  
  while ((match = regex.exec(texto)) !== null) {
    variaveis.push(match[1]);
  }
  
  return [...new Set(variaveis)]; // Remove duplicatas
}

// ✅ Função para validar se uma variável existe
function validarVariavel(variavel, variaveisDisponiveis) {
  // Verifica se a variável existe em qualquer categoria
  for (const categoria in variaveisDisponiveis) {
    if (variaveisDisponiveis[categoria] && variaveisDisponiveis[categoria][variavel]) {
      return true;
    }
  }
  return false;
}

function getMesNome(mes) {
  const meses = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];
  return meses[mes - 1] || '';
}

function getMesAbrev(mes) {
  const meses = [
    'JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN',
    'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'
  ];
  return meses[mes - 1] || '';
}



// Função utilitária para gerar data/hora do servidor (com ajuste para Brasília UTC-3)
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

// ✅ Criar nova obrigação
router.post("/criar", async (req, res) => {
  try {
    const {
      empresaId, departamentoId, nome, frequencia, diaSemana, acaoQtdDias, acaoTipoDias,
      metaQtdDias, metaTipoDias, vencimentoTipo, vencimentoDia, fatoGerador,
      orgao, aliasValidacao, geraMulta, usarRelatorio, reenviarEmail
    } = req.body;

    // Se o valor de 'fatoGerador' for vazio ou 0, substitua por NULL
    const fatoGeradorValue = fatoGerador === "" || fatoGerador === "0" ? null : fatoGerador;

    // Inserir no banco com o valor ajustado de fatoGerador
    const [resultado] =     await db.query(`
      INSERT INTO obrigacoes (
        empresa_id, departamento_id, nome, frequencia, dia_semana, acao_qtd_dias,
        meta_qtd_dias, meta_tipo_dias, vencimento_tipo, vencimento_dia, fato_gerador,
        orgao, gera_multa, usar_relatorio, reenviar_email
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        empresaId, departamentoId, nome, frequencia, diaSemana, acaoQtdDias,
        metaQtdDias, metaTipoDias, vencimentoTipo, vencimentoDia, fatoGeradorValue,
        orgao, geraMulta, usarRelatorio, reenviarEmail
      ]
    );

    res.status(201).json({ success: true, obrigacaoId: resultado.insertId });
  } catch (error) {
    console.error("Erro ao criar obrigação:", error);
    res.status(500).json({ error: "Erro ao criar obrigação." });
  }
});

// ✅ Importar obrigações por planilha
router.post('/importar-planilha',
  verifyToken,
  upload.single('file'),
  async (req, res) => {
    try {
      console.log('==== [IMPORTAÇÃO DE OBRIGAÇÕES] ====');
      console.log('req.body:', req.body);
      console.log('req.file:', req.file ? req.file.originalname : null);

      if (!req.file) {
        return res.status(400).json({ error: 'Arquivo não recebido.' });
      }

      // Buscar empresaId do usuário autenticado
      const empresaId = req.usuario?.empresaId || req.body.empresaId;

      if (!empresaId) {
        return res.status(400).json({ error: 'empresaId não fornecido.' });
      }

      const arquivo = req.file.path;

      // Ler planilha
      const wb = xlsx.readFile(arquivo);
      const planilha = wb.Sheets[wb.SheetNames[0]];
      const dados = xlsx.utils.sheet_to_json(planilha, { defval: '' });

      if (!dados.length) {
        fs.unlinkSync(arquivo);
        return res.status(400).json({ error: 'Planilha vazia ou não reconhecida.' });
      }

      console.log(`📊 Total de linhas na planilha: ${dados.length}`);

      // Normalizar chaves do cabeçalho
      const rawKeys = Object.keys(dados[0] || {});
      const keyMap = {};
      rawKeys.forEach(orig => {
        keyMap[orig.trim().toLowerCase()] = orig;
      });

      function getField(linha, key) {
        return linha[keyMap[key]] ?? null;
      }

      // Função para buscar múltiplas variações de nome de campo
      function getFieldMulti(linha, keys) {
        for (const key of keys) {
          const val = getField(linha, key);
          if (val) return val;
        }
        return null;
      }

      // Função auxiliar para verificar similaridade de nomes (evitar duplicatas)
      function nomeSimilar(nome1, nome2) {
        if (!nome1 || !nome2) return false;
        const n1 = nome1.toLowerCase().trim().replace(/\s+/g, ' ');
        const n2 = nome2.toLowerCase().trim().replace(/\s+/g, ' ');
        return n1 === n2;
      }

      let inseridos = 0;
      let pulados = 0;
      let erros = [];

      // Buscar todos os departamentos da empresa de uma vez
      const [departamentos] = await db.query(
        'SELECT id, nome FROM departamentos WHERE empresaId = ?',
        [empresaId]
      );
      
      // Função para encontrar departamento por similaridade
      function encontrarDepartamentoPorSimilaridade(nomeInput) {
        if (!nomeInput) return null;
        const nomeLower = nomeInput.toLowerCase().trim();
        
        // Mapeamento de nomes comuns para departamentos padrão
        const mapeamentoDepartamentos = {
          'departame': 'departamento pessoal',
          'financeiro': 'contábil', // Mapear Financeiro para Contábil
          'diretoria': 'contábil', // Mapear Diretoria para Contábil
          'cnd': 'contábil', // Mapear CND para Contábil
          'contabilida': 'contábil', // Corrigir truncamento
          'comercial': 'comercial',
          'fiscal': 'fiscal',
          'departamento pessoal': 'departamento pessoal',
          'contábil': 'contábil',
          'legalização': 'legalização',
          'marketing': 'marketing',
          'ti': 'ti'
        };
        
        // Verificar mapeamento direto primeiro
        const nomeMapeado = mapeamentoDepartamentos[nomeLower];
        if (nomeMapeado) {
          for (const dept of departamentos) {
            if (dept.nome.toLowerCase().trim() === nomeMapeado) {
              return dept.id;
            }
          }
        }
        
        // Busca exata primeiro
        for (const dept of departamentos) {
          if (dept.nome.toLowerCase().trim() === nomeLower) {
            return dept.id;
          }
        }
        
        // Busca por inclusão/parcial
        for (const dept of departamentos) {
          const deptLower = dept.nome.toLowerCase().trim();
          // Se o nome do banco contém o nome da planilha ou vice-versa
          if (deptLower.includes(nomeLower) || nomeLower.includes(deptLower)) {
            return dept.id;
          }
        }
        
        // Busca por similaridade (remover acentos e comparar)
        const removerAcentos = (str) => str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const nomeInputSemAcento = removerAcentos(nomeLower);
        
        for (const dept of departamentos) {
          const deptSemAcento = removerAcentos(dept.nome.toLowerCase().trim());
          if (deptSemAcento === nomeInputSemAcento || 
              deptSemAcento.includes(nomeInputSemAcento) || 
              nomeInputSemAcento.includes(deptSemAcento)) {
            return dept.id;
          }
        }
        
        return null;
      }

      // Buscar obrigações existentes para validar duplicatas
      const [obrigacoesExistentes] = await db.query(
        'SELECT nome FROM obrigacoes WHERE empresaId = ?',
        [empresaId]
      );
      const nomesExistentes = obrigacoesExistentes.map(o => o.nome);

      for (let idx = 0; idx < dados.length; idx++) {
        const linha = dados[idx];

        // Extrair dados da planilha
        const departamentoNome = getFieldMulti(linha, ['departamento', 'setor', 'dept']);
        const nome = getFieldMulti(linha, ['nome', 'obrigação', 'obrigacao']);
        const frequencia = getFieldMulti(linha, ['frequência', 'frequencia', 'periodicidade']);
        const acaoQtdDias = getFieldMulti(linha, ['ação(qtd dias)', 'acao(qtd dias)', 'acaoqtddias', 'qtd dias acao']);
        const diaMeta = getFieldMulti(linha, ['dia meta', 'meta', 'diameta', 'meta(qtd di', 'metaqtddias', 'meta qtd dias']);
        const diaVencimento = getFieldMulti(linha, ['dia vencimento', 'vencimento', 'diavencimento']);
        const fatoGerador = getFieldMulti(linha, ['fato gerador', 'fato gerador (competência)', 'fatogerador', 'competencia']);
        const orgao = getFieldMulti(linha, ['órgão', 'orgao']);
        const reenvio = getFieldMulti(linha, ['re-envio', 'reenvio', 'reenviar']);

        // Log da primeira linha para debug
        if (idx === 0) {
          console.log('🔍 Primeira linha extraída:', {
            departamentoNome,
            nome,
            frequencia,
            acaoQtdDias,
            diaMeta,
            diaVencimento,
            fatoGerador,
            orgao,
            reenvio
          });
        }

        // Validações obrigatórias
        if (!nome || !departamentoNome) {
          pulados++;
          erros.push(`Linha ${idx + 2}: Nome ou Departamento ausente.`);
          continue;
        }

        // Buscar departamentoId pelo nome com similaridade
        const departamentoId = encontrarDepartamentoPorSimilaridade(departamentoNome);
        if (!departamentoId) {
          pulados++;
          const deptsDisponiveis = departamentos.map(d => d.nome).join(', ');
          erros.push(`Linha ${idx + 2}: Departamento "${departamentoNome}" não encontrado. Disponíveis: ${deptsDisponiveis}`);
          continue;
        }

        // Verificar se já existe obrigação com nome similar
        const jaExiste = nomesExistentes.some(nomeExist => nomeSimilar(nomeExist, nome));
        if (jaExiste) {
          pulados++;
          erros.push(`Linha ${idx + 2}: Obrigação "${nome}" já existe (nome similar encontrado).`);
          continue;
        }

        // Processar campos opcionais
        const acaoQtdDiasNum = acaoQtdDias ? parseInt(acaoQtdDias) : null;
        const metaQtdDiasNum = diaMeta ? parseInt(diaMeta) : 0; // Valor padrão 0 quando null
        const vencimentoDiaNum = diaVencimento ? parseInt(diaVencimento) : null;
        const reenviarEmail = reenvio ? (reenvio.toString().toLowerCase() === 'sim' || reenvio === '1' || reenvio === 1 ? 1 : 0) : 0;

        // Valores padrão - sempre "Antecipar" para vencimentoTipo
        const diaSemana = null;
        const acaoTipoDias = null;  // Ignorar tipo de dias
        const metaTipoDias = null;  // Ignorar tipo de dias
        const vencimentoTipo = 'Antecipar';
        const aliasValidacao = null;
        const geraMulta = 0;
        const usarRelatorio = 0;

        try {
          // Inserir obrigação
          await db.query(`
            INSERT INTO obrigacoes (
              empresa_id, departamento_id, nome, frequencia, dia_semana, acao_qtd_dias,
              meta_qtd_dias, meta_tipo_dias, vencimento_tipo, vencimento_dia, fato_gerador,
              orgao, gera_multa, usar_relatorio, reenviar_email
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              empresaId, departamentoId, nome, frequencia, diaSemana, acaoQtdDiasNum,
              metaQtdDiasNum, metaTipoDias, vencimentoTipo, vencimentoDiaNum, fatoGerador,
              orgao, geraMulta, usarRelatorio, reenviarEmail
            ]
          );
          
          inseridos++;
          // Adicionar à lista de nomes existentes para evitar duplicatas dentro da mesma importação
          nomesExistentes.push(nome);
        } catch (err) {
          pulados++;
          erros.push(`Linha ${idx + 2}: Erro ao inserir - ${err.message}`);
        }
      }

      // Limpar arquivo temporário
      fs.unlinkSync(arquivo);

      res.json({
        inseridos,
        pulados,
        erros: erros.length > 0 ? erros : null,
        mensagem: `Importação concluída: ${inseridos} obrigações inseridas, ${pulados} puladas.`
      });

    } catch (err) {
      console.error('ERRO na importação de obrigações:', err);
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      res.status(500).json({ error: 'Erro ao importar planilha', detalhes: err.message });
    }
  }
);


// 📋 Listar obrigações - todas ou filtradas por empresa
+ router.get("/empresa/:empresaId", verifyToken, async (req, res) => {
  try {
    const { empresaId } = req.params; // Agora a empresaId vem dos parâmetros da URL
    const { clienteId } = req.query; // Se necessário filtrar por clienteId também

    let query = `
      SELECT o.*, d.nome as departamentoNome, e.razaoSocial as empresaNome
      FROM obrigacoes o
      JOIN departamentos d ON o.departamento_id = d.id
      JOIN empresas e ON o.empresa_id = e.id
      WHERE o.empresa_id = ?
    `;

    const params = [empresaId]; // A empresaId vem diretamente de req.params

    if (clienteId) {
      query += " AND o.clienteId = ?";
      params.push(clienteId); // Se você também quiser filtrar pelo clienteId
    }

    const [dados] = await db.query(query, params);
    res.json(dados);
  } catch (error) {
    console.error("Erro ao buscar obrigações:", error);
    res.status(500).json({ error: "Erro ao buscar obrigações." });
  }
});


// 🔍 Buscar obrigação individual por ID
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const [dados] = await db.query(`
        SELECT o.*, d.nome as departamentoNome, e.razaoSocial as empresaNome
        FROM obrigacoes o
        JOIN departamentos d ON o.departamento_id = d.id
        JOIN empresas e ON o.empresa_id = e.id
        WHERE o.id = ?`, [id]);

    if (dados.length === 0) {
      return res.status(404).json({ error: "Obrigação não encontrada." });
    }

    console.log("📌 Frequência recebida:", dados[0].frequencia);


    res.json(dados[0]);
  } catch (error) {
    console.error("Erro ao buscar obrigação:", error);
    res.status(500).json({ error: "Erro ao buscar obrigação." });
  }
});

// 📝 Atualizar
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const campos = req.body;

    // ⚠️ Remove campos que não existem no banco
    delete campos.departamentoNome;
    delete campos.empresaNome;
    delete campos.dataCriacao;

    // Converter camelCase para snake_case nos campos do banco
    const camposAtualizados = {};
    const mapeamento = {
      empresaId: 'empresa_id',
      departamentoId: 'departamento_id',
      diaSemana: 'dia_semana',
      acaoQtdDias: 'acao_qtd_dias',
      metaQtdDias: 'meta_qtd_dias',
      metaTipoDias: 'meta_tipo_dias',
      vencimentoTipo: 'vencimento_tipo',
      vencimentoDia: 'vencimento_dia',
      fatoGerador: 'fato_gerador',
      geraMulta: 'gera_multa',
      usarRelatorio: 'usar_relatorio',
      reenviarEmail: 'reenviar_email'
    };

    for (const [key, value] of Object.entries(campos)) {
      const nomeCorreto = mapeamento[key] || key;
      camposAtualizados[nomeCorreto] = value;
    }

    await db.query(`UPDATE obrigacoes SET ? WHERE id = ?`, [camposAtualizados, id]);
    res.json({ success: true });
  } catch (error) {
    console.error("Erro ao atualizar:", error);
    res.status(500).json({ error: "Erro ao atualizar obrigação." });
  }
});


// ❌ Deletar
router.delete("/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    await db.query(`DELETE FROM obrigacoes WHERE id = ?`, [id]);
    res.json({ success: true });
  } catch (error) {
    console.error("Erro ao deletar:", error);
    res.status(500).json({ error: "Erro ao deletar obrigação." });
  }
});

/** ------------------ OBRIGAÇÕES PARTICULARIDADES ------------------ **/

// ✅ Vincular uma particularidade à obrigação
router.post('/:obrigacaoId/particularidades', async (req, res) => {
  const { obrigacaoId } = req.params;
  const { tipo, particularidadeId } = req.body;

  try {
    await db.query(`
            INSERT INTO obrigacoes_particularidades (obrigacao_id, tipo, particularidade_id) 
            VALUES (?, ?, ?)`,
      [obrigacaoId, tipo, particularidadeId]
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Erro ao adicionar particularidade:', error);
    res.status(500).json({ error: 'Erro ao adicionar particularidade.' });
  }
});

// ✅ Listar todas particularidades vinculadas a uma obrigação
router.get('/:obrigacaoId/particularidades', async (req, res) => {
  const { obrigacaoId } = req.params;

  try {
    const [dados] = await db.query(`
            SELECT op.id, op.tipo, op.particularidadeId, p.nome, p.descricao, p.categoria 
            FROM obrigacoes_particularidades op
            JOIN particularidades p ON op.particularidadeId = p.id
            WHERE op.obrigacao_id = ?`,
      [obrigacaoId]
    );
    res.json(dados);
  } catch (error) {
    console.error('Erro ao buscar particularidades:', error);
    res.status(500).json({ error: 'Erro ao buscar particularidades.' });
  }
});

// ✅ Remover vínculo de particularidade
router.delete('/particularidades/:id', verifyToken, async (req, res) => {
  const { id } = req.params;

  try {
    await db.query(`DELETE FROM obrigacoes_particularidades WHERE id = ?`, [id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Erro ao remover particularidade:', error);
    res.status(500).json({ error: 'Erro ao remover particularidade.' });
  }
});

router.get("/cliente/:clienteId", async (req, res) => {
  const { clienteId } = req.params;

  try {
    // 1. Buscar respostas do cliente
    const [respostas] = await db.query(`
      SELECT r.particularidade_id
      FROM cliente_respostas cr
      JOIN enquete_respostas r ON cr.resposta_id = r.id
      WHERE cr.cliente_id = ?
    `, [clienteId]);
    const particularidadesCliente = respostas.map(r => r.particularidade_id);

    // 2. Buscar obrigações com suas particularidades
    const [obrigacoes] = await db.query(`
      SELECT 
        o.*, 
        d.nome as departamentoNome,
        op.tipo as tipoPart,
        op.particularidade_id
      FROM obrigacoes o
      JOIN departamentos d ON o.departamento_id = d.id
      JOIN obrigacoes_particularidades op ON op.obrigacao_id = o.id
    `);

    // 3. Agrupar particularidades por obrigação
    const obrigacoesMap = {};

    for (const row of obrigacoes) {
      if (!obrigacoesMap[row.id]) {
        obrigacoesMap[row.id] = {
          ...row,
          obrigacaoId: row.id,
          particularidadesE: [],
          particularidadesOU: [],
          particularidadesEXCETO: []
        };
      }

      if (row.tipoPart === "E") {
        obrigacoesMap[row.id].particularidadesE.push(row.particularidade_id);
      } else if (row.tipoPart === "OU") {
        obrigacoesMap[row.id].particularidadesOU.push(row.particularidade_id);
      } else if (row.tipoPart === "EXCETO") {
        obrigacoesMap[row.id].particularidadesEXCETO.push(row.particularidade_id);
      }
    }

    // 4. Validar match para cada obrigação (com debug)
    const obrigacoesValidas = Object.values(obrigacoesMap).filter(o => {
      const temTodasE = o.particularidadesE.every(p => particularidadesCliente.includes(p));
      const temAlgumaOU = o.particularidadesOU.length === 0 || o.particularidadesOU.some(p => particularidadesCliente.includes(p));
      const temAlgumExceto = o.particularidadesEXCETO.length > 0 && o.particularidadesEXCETO.some(p => particularidadesCliente.includes(p));
      // 🔍 LOG DE DEBUG AQUI:
      console.log({
        obrigacaoId: o.id,
        nomeObrigacao: o.nome,
        particularidadesE: o.particularidadesE,
        particularidadesOU: o.particularidadesOU,
        particularidadesEXCETO: o.particularidadesEXCETO,
        clientePossui: particularidadesCliente,
        temTodasE,
        temAlgumaOU,
        temAlgumExceto,
        vaiEntrar: temTodasE && temAlgumaOU && !temAlgumExceto
      });
      return temTodasE && temAlgumaOU && !temAlgumExceto;
    });

    res.json(obrigacoesValidas);
  } catch (err) {
    console.error("Erro ao filtrar obrigações por cliente:", err);
    res.status(500).json({ error: "Erro ao buscar obrigações filtradas." });
  }
});


router.get("/cliente/:clienteId/com-departamentos", async (req, res) => {
  const { clienteId } = req.params;

  try {
    // 1. Buscar respostas do cliente
    const [respostas] = await db.query(`
      SELECT r.particularidade_id
      FROM cliente_respostas cr
      JOIN enquete_respostas r ON cr.resposta_id = r.id
      WHERE cr.cliente_id = ?
    `, [clienteId]);
    const particularidadesCliente = respostas.map(r => r.particularidade_id);

    // 2. Buscar departamentos da empresa
    const [departamentos] = await db.query(`
      SELECT d.* FROM departamentos d
      JOIN empresas e ON d.empresa_id = e.id
      JOIN clientes c ON c.empresa_id = e.id AND c.id = ?
      ORDER BY d.nome
    `, [clienteId]);

    // 3. Buscar obrigações com suas particularidades
    const [obrigacoes] = await db.query(`
      SELECT 
        o.*, 
        d.nome as departamentoNome,
        op.tipo as tipoPart,
        op.particularidade_id
      FROM obrigacoes o
      JOIN departamentos d ON o.departamento_id = d.id
      JOIN obrigacoes_particularidades op ON op.obrigacao_id = o.id
      JOIN empresas e ON o.empresa_id = e.id
      JOIN clientes c ON c.empresa_id = e.id AND c.id = ?
    `, [clienteId]);

    // 4. Agrupar particularidades por obrigação
    const obrigacoesMap = {};

    for (const row of obrigacoes) {
      if (!obrigacoesMap[row.id]) {
        obrigacoesMap[row.id] = {
          ...row,
          obrigacaoId: row.id,
          particularidadesE: [],
          particularidadesOU: [],
          particularidadesEXCETO: []
        };
      }

      if (row.tipoPart === "E") {
        obrigacoesMap[row.id].particularidadesE.push(row.particularidade_id);
      } else if (row.tipoPart === "OU") {
        obrigacoesMap[row.id].particularidadesOU.push(row.particularidade_id);
      } else if (row.tipoPart === "EXCETO") {
        obrigacoesMap[row.id].particularidadesEXCETO.push(row.particularidade_id);
      }
    }

    // 4. Validar match para cada obrigação (com debug)
    const obrigacoesValidas = Object.values(obrigacoesMap).filter(o => {
      const temTodasE = o.particularidadesE.every(p => particularidadesCliente.includes(p));
      const temAlgumaOU = o.particularidadesOU.length === 0 || o.particularidadesOU.some(p => particularidadesCliente.includes(p));
      const temAlgumExceto = o.particularidadesEXCETO.length > 0 && o.particularidadesEXCETO.some(p => particularidadesCliente.includes(p));
      // 🔍 LOG DE DEBUG AQUI:
      console.log({
        obrigacaoId: o.id,
        nomeObrigacao: o.nome,
        particularidadesE: o.particularidadesE,
        particularidadesOU: o.particularidadesOU,
        particularidadesEXCETO: o.particularidadesEXCETO,
        clientePossui: particularidadesCliente,
        temTodasE,
        temAlgumaOU,
        temAlgumExceto,
        vaiEntrar: temTodasE && temAlgumaOU && !temAlgumExceto
      });
      return temTodasE && temAlgumaOU && !temAlgumExceto;
    });


    res.json({ departamentos, obrigacoes: obrigacoesValidas });
  } catch (err) {
    console.error("Erro ao buscar obrigações e departamentos:", err);
    res.status(500).json({ error: "Erro ao buscar dados." });
  }
});



router.get('/:id/clientes', verifyToken, async (req, res) => {
  const { id } = req.params;

  try {
    // 1. Buscar todas particularidades da obrigação com tipo (E, OU)
    const [particularidades] = await db.query(`
      SELECT tipo, particularidadeId
      FROM obrigacoes_particularidades
      WHERE obrigacao_id = ?
    `, [id]);

    if (particularidades.length === 0) {
      return res.json([]); // Nenhum critério vinculado
    }

    const obrigatorias = particularidades
      .filter(p => p.tipo === 'E')
      .map(p => p.particularidadeId);

    const alternativas = particularidades
      .filter(p => p.tipo === 'OU')
      .map(p => p.particularidadeId);

    // 2. Buscar todos os clientes
    const [clientes] = await db.query(`
      SELECT c.id, c.nome, c.cnpjCpf
      FROM clientes c
    `);

    // 3. Buscar todas as respostas dos clientes de uma só vez
    const [respostasClientes] = await db.query(`
      SELECT cr.clienteId, r.particularidadeId
      FROM cliente_respostas cr
      JOIN enquete_respostas r ON cr.respostaId = r.id
    `);

    // 4. Organizar respostas em um Map: clienteId => Set de particularidades
    const respostasMap = new Map();
    for (const linha of respostasClientes) {
      if (!respostasMap.has(linha.clienteId)) {
        respostasMap.set(linha.clienteId, new Set());
      }
      respostasMap.get(linha.clienteId).add(linha.particularidadeId);
    }

    // 5. Filtrar os clientes válidos com base nas regras
    const clientesValidos = clientes.filter(cliente => {
      const clienteParticularidades = respostasMap.get(cliente.id) || new Set();

      const atendeObrigatorias = obrigatorias.every(p => clienteParticularidades.has(p));
      const atendeAlgumaOU = alternativas.length === 0 || alternativas.some(p => clienteParticularidades.has(p));

      return atendeObrigatorias && atendeAlgumaOU;
    });

    res.json(clientesValidos);
  } catch (err) {
    console.error("Erro ao buscar clientes da obrigação:", err);
    res.status(500).json({ error: "Erro interno ao buscar clientes." });
  }
});



// 📌 Criar nova atividade para obrigação
router.post("/:obrigacaoId/atividades", verifyToken, async (req, res) => {
  const { obrigacaoId } = req.params;
  const { tipo, texto, descricao, tipoCancelamento, ordem, pdf_layout_id, titulo_documento } = req.body;

  try {
    await db.query(
      `INSERT INTO atividades_obrigacao 
       (obrigacaoId, tipo, texto, descricao, tipoCancelamento, ordem, pdf_layout_id, titulo_documento) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        obrigacaoId, 
        tipo, 
        texto, 
        descricao, 
        tipoCancelamento || "Com justificativa", 
        ordem || 1, 
        pdf_layout_id || null,
        titulo_documento || null
      ]
    );
    res.status(201).json({ success: true });
  } catch (error) {
    console.error("Erro ao criar atividade da obrigação:", error);
    res.status(500).json({ error: "Erro ao criar atividade." });
  }
});

// 📌 Listar atividades por obrigação
router.get("/:obrigacaoId/atividades", verifyToken, async (req, res) => {
  const { obrigacaoId } = req.params;

  try {
    const [atividades] = await db.query(
      `SELECT * FROM atividades_obrigacao 
       WHERE obrigacao_id = ? 
       ORDER BY ordem`,
      [obrigacaoId]
    );
    res.json(atividades);
  } catch (error) {
    console.error("Erro ao listar atividades da obrigação:", error);
    res.status(500).json({ error: "Erro ao listar atividades." });
  }
});

// 📌 Atualizar ordem
router.put("/atividades/:id/ordem", verifyToken, async (req, res) => {
  const { id } = req.params;
  const { novaOrdem } = req.body;

  try {
    await db.query(
      `UPDATE atividades_obrigacao SET ordem = ? WHERE id = ?`,
      [novaOrdem, id]
    );
    res.json({ success: true });
  } catch (error) {
    console.error("Erro ao atualizar ordem:", error);
    res.status(500).json({ error: "Erro ao atualizar ordem." });
  }
});

// 📌 Deletar atividade
router.delete("/atividades/:id", verifyToken, async (req, res) => {
  const { id } = req.params;
  try {
    await db.query(`DELETE FROM atividades_obrigacao WHERE id = ?`, [id]);
    res.json({ success: true });
  } catch (error) {
    console.error("Erro ao deletar atividade:", error);
    res.status(500).json({ error: "Erro ao deletar atividade." });
  }
});

function calcularVencimento(ano, mes, tipo, dia, fatoGerador) {
  // Função para obter o último dia do mês
  function getUltimoDiaMes(ano, mes) {
    return new Date(ano, mes, 0).getDate();
  }

  // Função para verificar se o dia existe no mês
  function diaExisteNoMes(ano, mes, dia) {
    const ultimoDia = getUltimoDiaMes(ano, mes);
    return dia <= ultimoDia;
  }

  // Função para ajustar dia para último dia do mês se necessário
  function ajustarDiaParaMes(ano, mes, dia) {
    if (diaExisteNoMes(ano, mes, dia)) {
      return dia;
    }
    return getUltimoDiaMes(ano, mes);
  }

  // Ajustar o dia se não existir no mês
  const diaAjustado = ajustarDiaParaMes(ano, mes, dia);
  let data = new Date(ano, mes - 1, diaAjustado);

  if (fatoGerador === 'Próximo mês') {
    data.setMonth(data.getMonth() + 1);
    // Reajustar o dia após mudar o mês
    const novoMes = data.getMonth() + 1;
    const novoAno = data.getFullYear();
    const diaAjustadoNovoMes = ajustarDiaParaMes(novoAno, novoMes, dia);
    data = new Date(novoAno, novoMes - 1, diaAjustadoNovoMes);
  }

  // Aplicar regras de antecipação/postergação para fins de semana
  if (tipo === 'Antecipar') {
    while (data.getDay() === 0 || data.getDay() === 6) {
      data = subDays(data, 1);
    }
  } else if (tipo === 'Postergar') {
    while (data.getDay() === 0 || data.getDay() === 6) {
      data = addDays(data, 1);
    }
  }

  const resultado = data.toISOString().split('T')[0];
  
  // Log para debug (pode ser removido em produção)
  if (dia !== diaAjustado) {
    console.log(`🔧 Ajuste de data: dia ${dia} não existe no mês ${mes}/${ano}, ajustado para ${diaAjustado}`);
  }
  
  return resultado;
}

// 📌 Atualizar uma atividade da obrigação
router.put("/atividades/:id", verifyToken, async (req, res) => {
  const { id } = req.params;
  const {
    tipo,
    texto,
    descricao,
    tipoCancelamento,
    ordem,
    pdf_layout_id,
    titulo_documento
  } = req.body;

  try {
    await db.query(`
      UPDATE atividades_obrigacao 
      SET tipo = ?, texto = ?, descricao = ?, tipoCancelamento = ?, ordem = ?, pdf_layout_id = ?, titulo_documento = ?
      WHERE id = ?`,
      [
        tipo, 
        texto, 
        descricao, 
        tipoCancelamento, 
        ordem, 
        pdf_layout_id || null, 
        titulo_documento || null,
        id
      ]
    );

    res.json({ success: true });
  } catch (error) {
    console.error("Erro ao atualizar atividade:", error);
    res.status(500).json({ error: "Erro ao atualizar atividade." });
  }
});

exports.gerarAtividades = async (req, res) => {
  const obrigacaoId = Number(req.params.id);
  const { ano, mesInicio, mesFim } = req.body;

  try {
    const obrigacao = await db('obrigacoes').where({ id: obrigacaoId }).first();
    if (!obrigacao) return res.status(404).json({ erro: 'Obrigacao não encontrada' });

    // CORRETA: usando cliente_respostas e enquete_respostas
    const [vinculados] = await db.query(`
  SELECT DISTINCT cr.clienteId
  FROM obrigacoes_particularidades op
  JOIN enquete_respostas er ON op.particularidadeId = er.particularidadeId
  JOIN cliente_respostas cr ON cr.respostaId = er.id
  WHERE op.obrigacaoId = ?
`, [obrigacaoId]);


    const clientes = vinculados.map(v => v.cliente_id);

    for (let mes = mesInicio; mes <= mesFim; mes++) {
      for (const clienteId of clientes) {
        try {
          await db.query(`
  INSERT INTO obrigacoes_atividades 
    (cliente_id, obrigacao_id, nome, descricao, ano_referencia, mes_referencia, vencimento) 
  VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [clienteId, obrigacaoId, obrigacao.nome, `Obrigacao ${obrigacao.nome} de ${mes}/${ano}`, ano, mes, vencimento]
          );
        } catch (err) {
          if (!err.message.includes('Duplicate')) {
            console.error(err);
          }
        }
      }
    }

  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao gerar atividades' });
  }
};

// 📌 Gerar tarefas (atividades) para uma obrigação com base nos filtros de ano e mês
router.post("/:id/gerar-atividades", verifyToken, async (req, res) => {
  const obrigacaoId = Number(req.params.id);
  const { ano, mesInicio, mesFim, clienteIds } = req.body;

  // Função para inserir as atividades base em batch
  async function clonarAtividadesBase(clienteId, obrigacaoClienteId, atividadesBase) {
    if (atividadesBase.length === 0) return;
    
    // Verificar se já existem atividades para esta obrigação do cliente
    const [atividadesExistentes] = await db.query(`
      SELECT id FROM obrigacoes_atividades_clientes 
      WHERE cliente_id = ? AND obrigacao_cliente_id = ?
    `, [clienteId, obrigacaoClienteId]);
    
    // Se já existem atividades, não inserir novamente
    if (atividadesExistentes.length > 0) {
      console.log(`⚠️ Atividades já existem para cliente ${clienteId}, obrigação ${obrigacaoClienteId}. Pulando inserção.`);
      return;
    }
    
    const values = atividadesBase.map(atv => [
      clienteId,
      obrigacaoClienteId,
      atv.tipo,
      atv.texto,
      atv.descricao,
      atv.tipoCancelamento,
      atv.ordem,
    ]);
    const placeholders = values.map(() => "(?, ?, ?, ?, ?, ?, ?)").join(", ");
    const flatValues = values.flat();
    await db.query(`
      INSERT INTO obrigacoes_atividades_clientes
      (cliente_id, obrigacao_cliente_id, tipo, texto, descricao, tipo_cancelamento, ordem)
      VALUES ${placeholders}
    `, flatValues);
    
    console.log(`✅ Inseridas ${atividadesBase.length} atividades para cliente ${clienteId}, obrigação ${obrigacaoClienteId}`);
  }

  function calcularAnoReferencia(anoAtual, fatoGerador) {
    switch (fatoGerador) {
      case "6 anos anteriores": return anoAtual - 6;
      case "5 anos anteriores": return anoAtual - 5;
      case "4 anos anteriores": return anoAtual - 4;
      case "3 anos anteriores": return anoAtual - 3;
      case "2 anos anteriores": return anoAtual - 2;
      case "Ano anterior": return anoAtual - 1;
      case "Próximo ano": return anoAtual + 1;
      case "Mesmo ano":
      default: return anoAtual;
    }
  }

  function calcularMesReferencia(mesVencimento, fatoGerador) {
    switch (fatoGerador) {
      case "Mês anterior":
        const mesAnterior = mesVencimento - 1;
        return mesAnterior < 1 ? 12 : mesAnterior;
      case "Próximo mês":
        const proximoMes = mesVencimento + 1;
        return proximoMes > 12 ? 1 : proximoMes;
      case "Mesmo mês":
      default:
        return mesVencimento;
    }
  }

  const MAX_PARALLEL = 10;
  async function processarLote(lote, atividadesBase, obrigacao, responsaveisIndividuaisMap, responsavelGlobalId) {
            await Promise.all(lote.map(async ({ clienteId, anoCalc, mesReferencia, vencimento, nomeObrigacao, acao, meta }) => {
          try {
            const [existentes] = await db.query(`
              SELECT id FROM obrigacoes_clientes
              WHERE cliente_id = ? AND obrigacao_id = ? AND ano_referencia = ? AND mes_referencia = ?
            `, [clienteId, obrigacao.id, anoCalc, mesReferencia]);
            if (existentes.length > 0) {
              return;
            }

        // Buscar responsável individual
        const responsavelId = responsaveisIndividuaisMap.get(clienteId) || responsavelGlobalId || null;

        const [res] = await db.query(`
          INSERT INTO obrigacoes_clientes
          (clienteId, obrigacaoId, nome, descricao, status, ano_referencia, mes_referencia, vencimento, dataCriacao, responsavelId, acao, meta)
          VALUES (?, ?, ?, ?, 'pendente', ?, ?, ?, NOW(), ?, ?, ?)
        `, [
          clienteId,
          obrigacao.id,
          obrigacao.nome, // <-- nome base, sem competência
          `Obrigação ${obrigacao.nome} de ${String(mesReferencia).padStart(2, "0")}/${anoCalc}`,
          anoCalc,
          mesReferencia,
          vencimento,
          responsavelId,
          acao,
          meta,
        ]);
        
        console.log("✅ Tarefa gerada! obrigacaoClienteId:", res.insertId, "| clienteId:", clienteId, "| responsavelId:", responsavelId);
        // NOVO: Popular obrigacoes_clientes_responsaveis
        console.log(`🔍 Inserindo múltiplos responsáveis para obrigacaoClienteId: ${res.insertId}, obrigacaoId: ${obrigacao.id}, clienteId: ${clienteId}`);
        
        // Buscar responsáveis individuais do cliente
        const [multiResponsaveisIndividuais] = await db.query(`
          SELECT usuario_id FROM obrigacoes_responsaveis_cliente WHERE obrigacao_id = ? AND cliente_id = ?
        `, [obrigacao.id, clienteId]);
        
        // Buscar responsáveis globais (clienteId = null)
        const [multiResponsaveisGlobais] = await db.query(`
          SELECT usuario_id FROM obrigacoes_responsaveis_cliente WHERE obrigacao_id = ? AND cliente_id IS NULL
        `, [obrigacao.id]);
        
        console.log(`🔍 Responsáveis individuais encontrados:`, multiResponsaveisIndividuais);
        console.log(`🔍 Responsáveis globais encontrados:`, multiResponsaveisGlobais);
        
        // Se há responsáveis individuais, usar apenas eles
        // Se não há individuais, usar os globais
        const responsaveisParaInserir = multiResponsaveisIndividuais.length > 0 
          ? multiResponsaveisIndividuais 
          : multiResponsaveisGlobais;
        
        if (responsaveisParaInserir.length > 0) {
          console.log(`🔍 Inserindo ${responsaveisParaInserir.length} responsáveis`);
          for (const resp of responsaveisParaInserir) {
            console.log(`🔍 Inserindo responsável: ${resp.usuarioId}`);
            await db.query(`
              INSERT IGNORE INTO obrigacoes_clientes_responsaveis (obrigacaoClienteId, usuarioId)
              VALUES (?, ?)
            `, [res.insertId, resp.usuarioId]);
          }
        } else {
          console.log(`🔍 Nenhum responsável encontrado para inserir`);
        }
        await clonarAtividadesBase(clienteId, res.insertId, atividadesBase);
      } catch (err) {
        if (!err.message.includes("Duplicate")) console.error("Erro ao inserir tarefa:", err);
      }
    }));
  }

  try {
    const [obrigacoes] = await db.query(`SELECT * FROM obrigacoes WHERE id = ?`, [obrigacaoId]);
    const obrigacao = obrigacoes[0];
    if (!obrigacao) return res.status(404).json({ erro: 'Obrigacao nao encontrada' });

    const [atividadesBase] = await db.query(`SELECT * FROM atividades_obrigacao WHERE obrigacaoId = ?`, [obrigacaoId]);

    // ✅ NOVO: Usar apenas os clientes selecionados pelo usuário
    if (!clienteIds || !Array.isArray(clienteIds) || clienteIds.length === 0) {
      return res.status(400).json({ erro: 'clienteIds é obrigatório e deve ser um array não vazio.' });
    }
    
    // Buscar responsáveis individuais para os clientes selecionados
    const [clientesTodos] = await db.query(`SELECT c.id FROM clientes c WHERE c.id IN (?)`, [clienteIds]);
    const clienteIdsValidados = clientesTodos.map(c => c.id);
    let responsaveisIndividuais = [];
    if (clienteIdsValidados.length > 0) {
      const [rows] = await db.query(`
        SELECT rc.clienteId, rc.usuarioId
        FROM obrigacoes_responsaveis_cliente rc
        WHERE rc.obrigacaoId = ? AND rc.clienteId IN (?)
      `, [obrigacaoId, clienteIdsValidados]);
      responsaveisIndividuais = rows;
    }
    const responsaveisIndividuaisMap = new Map();
    for (const r of responsaveisIndividuais) {
      responsaveisIndividuaisMap.set(r.clienteId, r.usuarioId);
    }
    // Buscar responsável global (clienteId = null)
    const [[globalResp]] = await db.query(`
      SELECT usuarioId FROM obrigacoes_responsaveis_cliente WHERE obrigacaoId = ? AND clienteId IS NULL
    `, [obrigacaoId]);
    const responsavelGlobalId = globalResp ? globalResp.usuarioId : null;

    // Particularidades (mantido)
    const [particularidadesE] = await db.query(`
      SELECT particularidadeId FROM obrigacoes_particularidades WHERE obrigacaoId = ? AND tipo = 'E'
    `, [obrigacaoId]);
    const [particularidadesOU] = await db.query(`
      SELECT particularidadeId FROM obrigacoes_particularidades WHERE obrigacaoId = ? AND tipo = 'OU'
    `, [obrigacaoId]);
    const [particularidadesEXCETO] = await db.query(`
      SELECT particularidadeId FROM obrigacoes_particularidades WHERE obrigacaoId = ? AND tipo = 'EXCETO'
    `, [obrigacaoId]);
    const partE = particularidadesE.map(p => p.particularidadeId);
    const partOU = particularidadesOU.map(p => p.particularidadeId);
    const partEXCETO = particularidadesEXCETO.map(p => p.particularidadeId);

    const [respostasClientes] = await db.query(`
      SELECT cr.clienteId, er.particularidadeId
      FROM cliente_respostas cr
      JOIN enquete_respostas er ON cr.respostaId = er.id
    `);

    const respostasMap = new Map();
    for (const linha of respostasClientes) {
      if (!respostasMap.has(linha.clienteId)) {
        respostasMap.set(linha.clienteId, new Set());
      }
      respostasMap.get(linha.clienteId).add(linha.particularidadeId);
    }

        // ✅ NOVO: Filtrar apenas os clientes selecionados que atendem às particularidades
        const clientes = clienteIdsValidados.filter(clienteId => {
          const clienteParticularidades = respostasMap.get(clienteId) || new Set();
          const atendeTodasE = partE.every(pid => clienteParticularidades.has(pid));
          const atendeAlgumaOU = partOU.length === 0 || partOU.some(pid => clienteParticularidades.has(pid));
          const temAlgumExceto = partEXCETO.length > 0 && partEXCETO.some(pid => clienteParticularidades.has(pid));
          return atendeTodasE && atendeAlgumaOU && !temAlgumExceto;
        });
    
    // ✅ NOVO: Log detalhado dos clientes selecionados vs elegíveis
    console.log("🟢 Clientes selecionados vs elegíveis:", {
      selecionados: clienteIdsValidados.length,
      elegiveis: clientes.length,
      naoElegiveis: clienteIdsValidados.length - clientes.length,
      clientesElegiveis: clientes
    });

    // Simulação (mantido)
    if (req.query.simular === "1") {
      const [nomes] = await db.query(
        `SELECT id, nome FROM clientes WHERE id IN (${clientes.join(',')})`
      );
      return res.json({ quantidade: clientes.length, clientes: nomes });
    }
    if (clientes.length === 0) {
      return res.status(200).json({ 
        ok: true, 
        mensagem: `Nenhum dos ${clienteIdsValidados.length} clientes selecionados atende às particularidades da obrigação.`,
        clientesSelecionados: clienteIdsValidados.length,
        clientesElegiveis: 0
      });
    }

    // Frequências (mantido)
    let meses = [];
    console.log(`📌 Frequência recebida: ${obrigacao.frequencia}`);
    console.log(`📌 Período: ${mesInicio} a ${mesFim}`);
    
    switch (obrigacao.frequencia) {
      case "Mensal":        for (let i = mesInicio; i <= mesFim; i++) meses.push(i); break;
      case "Bimestral":     for (let i = mesInicio; i <= mesFim; i += 2) meses.push(i); break;
      case "Trimestral":
      case "Trimestral 2 Cotas":
      case "Trimestral 3 Cotas": 
        for (let i = mesInicio; i <= mesFim; i += 3) meses.push(i); 
        console.log(`📌 Meses trimestrais calculados: ${meses.join(', ')}`);
        break;
      case "Quadrimestral": for (let i = mesInicio; i <= mesFim; i += 4) meses.push(i); break;
      case "Semestral":     for (let i = mesInicio; i <= mesFim; i += 6) meses.push(i); break;
      case "Anual":
        // 🎯 CORREÇÃO: Obrigações anuais devem usar o campo diaSemana como mês
        const mesAnual = obterMesDoDiaSemana(obrigacao.diaSemana);
        if (mesAnual) {
          // Lógica inteligente: verificar se o mês ainda cabe no ano atual
          const mesAtual = new Date().getMonth() + 1; // Mês atual (1-12)
          
          if (mesAnual >= mesInicio && mesAnual <= mesFim) {
            // Mês está dentro do período selecionado
            meses = [mesAnual];
            console.log(`📌 Obrigação anual configurada para mês: ${mesAnual} (${obrigacao.diaSemana}) - dentro do período`);
          } else if (mesAnual < mesAtual && mesInicio <= 12) {
            // Mês já passou no ano atual, mas usuário pode querer gerar para o próximo ano
            // Verificar se o mês cabe no período estendido (até dezembro)
            const mesProximoAno = mesAnual;
            if (mesProximoAno >= 1 && mesProximoAno <= 12) {
              meses = [mesProximoAno];
              console.log(`📌 Obrigação anual configurada para mês: ${mesProximoAno} (${obrigacao.diaSemana}) - próximo ano`);
            } else {
              meses = [];
              console.log(`⚠️ Mês anual ${mesAnual} (${obrigacao.diaSemana}) não pode ser processado`);
            }
          } else {
            meses = [];
            console.log(`⚠️ Mês anual ${mesAnual} (${obrigacao.diaSemana}) fora do período ${mesInicio}-${mesFim}`);
          }
        } else {
          console.log(`⚠️ Mês anual inválido: ${obrigacao.diaSemana}`);
          meses = [];
        }
        break;
      case "Esporadica":    meses = [mesInicio]; break;
      case "Diário":
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        // Buscar todas as obrigações já existentes para o período, clientes e obrigação
        const [existentesDiario] = await db.query(`
          SELECT clienteId, obrigacaoId, ano_referencia, mes_referencia, vencimento
          FROM obrigacoes_clientes
          WHERE obrigacao_id = ? AND ano_referencia = ? AND mes_referencia BETWEEN ? AND ?
            AND clienteId IN (${clientes.map(() => '?').join(',')})
        `, [obrigacaoId, ano, mesInicio, mesFim, ...clientes]);
        const existeSetDiario = new Set(existentesDiario.map(e => `${e.clienteId}|${e.obrigacaoId}|${e.ano_referencia}|${e.mes_referencia}|${e.vencimento.toISOString().slice(0,10)}`));
        const novasDiario = [];
        for (let mes = mesInicio; mes <= mesFim; mes++) {
          const diasNoMes = new Date(ano, mes, 0).getDate();
          for (let dia = 1; dia <= diasNoMes; dia++) {
            const data = new Date(ano, mes - 1, dia);
            data.setHours(0, 0, 0, 0);
            if (data < hoje) continue;
            const weekday = data.getDay();
            if (weekday === 0 || weekday === 6) continue;
            for (const clienteId of clientes) {
              const chave = `${clienteId}|${obrigacaoId}|${ano}|${mes}|${data.toISOString().slice(0,10)}`;
              if (existeSetDiario.has(chave)) continue;
              // Calcular acao/meta
              const vencimento = data.toISOString().split("T")[0];
              const meta = obrigacao.metaQtdDias != null && obrigacao.metaTipoDias ? subtrairDias(vencimento, obrigacao.metaQtdDias, obrigacao.metaTipoDias).toISOString().split("T")[0] : null;
              const acao = obrigacao.acaoQtdDias != null && obrigacao.acaoTipoDias ? subtrairDias(meta, obrigacao.acaoQtdDias, obrigacao.acaoTipoDias).toISOString().split("T")[0] : null;
              const responsavelId = responsaveisIndividuaisMap.get(clienteId) || responsavelGlobalId || null;
              novasDiario.push([
                clienteId,
                obrigacaoId,
                obrigacao.nome,
                `Obrigacao ${obrigacao.nome} de ${String(mes).padStart(2, "0")}/${ano}`,
                'pendente',
                ano,
                mes,
                vencimento,
                responsavelId,
                acao,
                meta
              ]);
            }
          }
        }
        if (novasDiario.length) {
          const placeholders = novasDiario.map(() => "(?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?)").join(",");
          const flat = novasDiario.flat();
          const [result] = await db.query(`
            INSERT INTO obrigacoes_clientes
            (cliente_id, obrigacao_id, nome, descricao, status, ano_referencia, mes_referencia, vencimento, data_criacao, responsavel_id, acao, meta)
            VALUES ${placeholders}
          `, flat);
          // Buscar os IDs inseridos
          const insertedIds = [];
          const [ultimos] = await db.query('SELECT id, clienteId FROM obrigacoes_clientes WHERE obrigacaoId = ? AND ano_referencia = ? AND mes_referencia BETWEEN ? AND ? AND clienteId IN (' + clientes.map(() => '?').join(',') + ')', [obrigacaoId, ano, mesInicio, mesFim, ...clientes]);
          for (const row of ultimos) insertedIds.push({ id: row.id, clienteId: row.clienteId });
          
          // NOVO: Popular obrigacoes_clientes_responsaveis para inserções em lote (Diário)
          console.log(`🔍 Processando ${insertedIds.length} tarefas inseridas em lote (Diário)`);
          for (const { id: obrigacaoClienteId, clienteId } of insertedIds) {
            console.log(`🔍 Inserindo múltiplos responsáveis para obrigacaoClienteId: ${obrigacaoClienteId}, clienteId: ${clienteId}`);
            
            // Buscar responsáveis individuais do cliente
            const [multiResponsaveisIndividuais] = await db.query(`
              SELECT usuario_id FROM obrigacoes_responsaveis_cliente WHERE obrigacao_id = ? AND cliente_id = ?
            `, [obrigacaoId, clienteId]);
            
            // Buscar responsáveis globais (clienteId = null)
            const [multiResponsaveisGlobais] = await db.query(`
              SELECT usuario_id FROM obrigacoes_responsaveis_cliente WHERE obrigacao_id = ? AND cliente_id IS NULL
            `, [obrigacaoId]);
            
            console.log(`🔍 Responsáveis individuais encontrados para cliente ${clienteId}:`, multiResponsaveisIndividuais);
            console.log(`🔍 Responsáveis globais encontrados:`, multiResponsaveisGlobais);
            
            // Se há responsáveis individuais, usar apenas eles
            // Se não há individuais, usar os globais
            const responsaveisParaInserir = multiResponsaveisIndividuais.length > 0 
              ? multiResponsaveisIndividuais 
              : multiResponsaveisGlobais;
            
            if (responsaveisParaInserir.length > 0) {
              console.log(`🔍 Inserindo ${responsaveisParaInserir.length} responsáveis`);
              for (const resp of responsaveisParaInserir) {
                console.log(`🔍 Inserindo responsável: ${resp.usuarioId}`);
                await db.query(`
                  INSERT INTO obrigacoes_clientes_responsaveis (obrigacao_cliente_id, usuario_id)
                  VALUES (?, ?)
                `, [obrigacaoClienteId, resp.usuarioId]);
              }
            } else {
              console.log(`🔍 Nenhum responsável encontrado para inserir`);
            }
          }
          
          // Clonar atividades base para cada nova obrigação
          for (const { id, clienteId } of insertedIds) {
            await clonarAtividadesBase(clienteId, id, atividadesBase);
          }
        }
        return res.status(200).json({ ok: true });
      case "Semanal":
        const hojeSemanal = new Date();
        hojeSemanal.setHours(0, 0, 0, 0);
        const diaSemanaMap = {
          Domingo: 0, Segunda: 1, Terca: 2, Terça: 2, Quarta: 3, Quinta: 4, Sexta: 5, Sabado: 6,
        };
        const diaAlvo = diaSemanaMap[obrigacao.diaSemana];
        if (diaAlvo === undefined) return res.status(400).json({ error: "Dia da semana inválido" });
        // Buscar todas as obrigações já existentes para o período, clientes e obrigação
        const [existentesSemanal] = await db.query(`
          SELECT clienteId, obrigacaoId, ano_referencia, mes_referencia, vencimento
          FROM obrigacoes_clientes
          WHERE obrigacao_id = ? AND ano_referencia = ? AND mes_referencia BETWEEN ? AND ?
            AND clienteId IN (${clientes.map(() => '?').join(',')})
        `, [obrigacaoId, ano, mesInicio, mesFim, ...clientes]);
        const existeSetSemanal = new Set(existentesSemanal.map(e => `${e.clienteId}|${e.obrigacaoId}|${e.ano_referencia}|${e.mes_referencia}|${e.vencimento.toISOString().slice(0,10)}`));
        const novasSemanal = [];
        for (let mes = mesInicio; mes <= mesFim; mes++) {
          const diasNoMes = new Date(ano, mes, 0).getDate();
          for (let dia = 1; dia <= diasNoMes; dia++) {
            const data = new Date(ano, mes - 1, dia);
            data.setHours(0, 0, 0, 0);
            if (data < hojeSemanal) continue;
            if (data.getDay() !== diaAlvo) continue;
            for (const clienteId of clientes) {
              const chave = `${clienteId}|${obrigacaoId}|${ano}|${mes}|${data.toISOString().slice(0,10)}`;
              if (existeSetSemanal.has(chave)) continue;
              // Calcular acao/meta
              const vencimento = data.toISOString().split("T")[0];
              const meta = obrigacao.metaQtdDias != null && obrigacao.metaTipoDias ? subtrairDias(vencimento, obrigacao.metaQtdDias, obrigacao.metaTipoDias).toISOString().split("T")[0] : null;
              const acao = obrigacao.acaoQtdDias != null && obrigacao.acaoTipoDias ? subtrairDias(meta, obrigacao.acaoQtdDias, obrigacao.acaoTipoDias).toISOString().split("T")[0] : null;
              const responsavelId = responsaveisIndividuaisMap.get(clienteId) || responsavelGlobalId || null;
              novasSemanal.push([
                clienteId,
                obrigacaoId,
                obrigacao.nome,
                `Obrigacao ${obrigacao.nome} de ${String(mes).padStart(2, "0")}/${ano}`,
                'pendente',
                ano,
                mes,
                vencimento,
                responsavelId,
                acao,
                meta
              ]);
            }
          }
        }
        if (novasSemanal.length) {
          const placeholders = novasSemanal.map(() => "(?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?)").join(",");
          const flat = novasSemanal.flat();
          const [result] = await db.query(`
            INSERT INTO obrigacoes_clientes
            (cliente_id, obrigacao_id, nome, descricao, status, ano_referencia, mes_referencia, vencimento, data_criacao, responsavel_id, acao, meta)
            VALUES ${placeholders}
          `, flat);
          // Buscar os IDs inseridos
          const insertedIds = [];
          const [ultimos] = await db.query('SELECT id, clienteId FROM obrigacoes_clientes WHERE obrigacaoId = ? AND ano_referencia = ? AND mes_referencia BETWEEN ? AND ? AND clienteId IN (' + clientes.map(() => '?').join(',') + ')', [obrigacaoId, ano, mesInicio, mesFim, ...clientes]);
          for (const row of ultimos) insertedIds.push({ id: row.id, clienteId: row.clienteId });
          
          // NOVO: Popular obrigacoes_clientes_responsaveis para inserções em lote (Semanal)
          console.log(`🔍 Processando ${insertedIds.length} tarefas inseridas em lote (Semanal)`);
          for (const { id: obrigacaoClienteId, clienteId } of insertedIds) {
            console.log(`🔍 Inserindo múltiplos responsáveis para obrigacaoClienteId: ${obrigacaoClienteId}, clienteId: ${clienteId}`);
            
            // Buscar responsáveis individuais do cliente
            const [multiResponsaveisIndividuais] = await db.query(`
              SELECT usuario_id FROM obrigacoes_responsaveis_cliente WHERE obrigacao_id = ? AND cliente_id = ?
            `, [obrigacaoId, clienteId]);
            
            // Buscar responsáveis globais (clienteId = null)
            const [multiResponsaveisGlobais] = await db.query(`
              SELECT usuario_id FROM obrigacoes_responsaveis_cliente WHERE obrigacao_id = ? AND cliente_id IS NULL
            `, [obrigacaoId]);
            
            console.log(`🔍 Responsáveis individuais encontrados para cliente ${clienteId}:`, multiResponsaveisIndividuais);
            console.log(`🔍 Responsáveis globais encontrados:`, multiResponsaveisGlobais);
            
            // Se há responsáveis individuais, usar apenas eles
            // Se não há individuais, usar os globais
            const responsaveisParaInserir = multiResponsaveisIndividuais.length > 0 
              ? multiResponsaveisIndividuais 
              : multiResponsaveisGlobais;
            
            if (responsaveisParaInserir.length > 0) {
              console.log(`🔍 Inserindo ${responsaveisParaInserir.length} responsáveis`);
              for (const resp of responsaveisParaInserir) {
                console.log(`🔍 Inserindo responsável: ${resp.usuarioId}`);
                await db.query(`
                  INSERT INTO obrigacoes_clientes_responsaveis (obrigacao_cliente_id, usuario_id)
                  VALUES (?, ?)
                `, [obrigacaoClienteId, resp.usuarioId]);
              }
            } else {
              console.log(`🔍 Nenhum responsável encontrado para inserir`);
            }
          }
          
          // Clonar atividades base para cada nova obrigação
          for (const { id, clienteId } of insertedIds) {
            await clonarAtividadesBase(clienteId, id, atividadesBase);
          }
        }
        return res.status(200).json({ ok: true });
      default: return res.status(400).json({ error: "Frequencia invalida ou nao suportada." });
    }

    // Lógica de fato gerador - define o ano e mês de referência baseado no fato gerador
    const anoReferencia = calcularAnoReferencia(ano, obrigacao.fatoGerador);
    const tarefasParaCriar = [];
    
    console.log(`📌 Total de meses para processar: ${meses.length}`);
    console.log(`📌 Clientes elegíveis: ${clientes.length}`);
    
    for (const mesVencimento of meses) {
      console.log(`📌 Processando mês de vencimento: ${mesVencimento}`);
      // Calcular mês de referência baseado no fato gerador
      let mesCompetencia = calcularMesReferencia(mesVencimento, obrigacao.fatoGerador);
      let anoCompetencia = anoReferencia;
  
      // Ajustar ano se necessário quando o mês muda
      if (obrigacao.fatoGerador === 'Mês anterior' && mesCompetencia === 12 && mesVencimento === 1) {
        anoCompetencia = anoReferencia - 1;
      } else if (obrigacao.fatoGerador === 'Próximo mês' && mesCompetencia === 1 && mesVencimento === 12) {
        anoCompetencia = anoReferencia + 1;
      }
      
      const vencimento = calcularVencimento(
        ano, // ano de vencimento sempre é o ano atual
        mesVencimento,
        obrigacao.vencimentoTipo,
        obrigacao.vencimentoDia,
        obrigacao.fatoGerador
      );
      
      // Calcular acao/meta
      const meta = obrigacao.metaQtdDias != null && obrigacao.metaTipoDias ? subtrairDias(vencimento, obrigacao.metaQtdDias, obrigacao.metaTipoDias).toISOString().split("T")[0] : null;
      const acao = obrigacao.acaoQtdDias != null && obrigacao.acaoTipoDias ? subtrairDias(meta, obrigacao.acaoQtdDias, obrigacao.acaoTipoDias).toISOString().split("T")[0] : null;
      
      for (const clienteId of clientes) {
        tarefasParaCriar.push({
          clienteId,
          anoCalc: anoCompetencia, // ano de referência baseado no fato gerador
          mesReferencia: mesCompetencia,
          vencimento,
          nomeObrigacao: `${obrigacao.nome} de ${String(mesCompetencia).padStart(2, "0")}/${anoCompetencia}`,
          acao,
          meta,
        });
      }
    }
    

    console.log(`📌 Total de tarefas a serem criadas: ${tarefasParaCriar.length}`);
    
    for (let i = 0; i < tarefasParaCriar.length; i += MAX_PARALLEL) {
      const lote = tarefasParaCriar.slice(i, i + MAX_PARALLEL);
      console.log(`📌 Processando lote ${Math.floor(i/MAX_PARALLEL) + 1} com ${lote.length} tarefas`);
      await processarLote(lote, atividadesBase, obrigacao, responsaveisIndividuaisMap, responsavelGlobalId);
    }
    
    // ✅ NOVO: Retorno com informações detalhadas
    res.status(200).json({ 
      ok: true, 
      mensagem: `Tarefas geradas com sucesso para ${clientes.length} de ${clienteIdsValidados.length} clientes selecionados.`,
      clientesSelecionados: clienteIdsValidados.length,
      clientesElegiveis: clientes.length,
      tarefasGeradas: tarefasParaCriar.length
    });
  } catch (err) {
    console.error("Erro ao gerar atividades:", err);
    res.status(500).json({ erro: 'Erro ao gerar atividades' });
  }
});



router.get("/empresa/:empresaId/com-atividades", verifyToken, async (req, res) => {
  const { empresaId } = req.params;

  try {
    const [obrigações] = await db.query(
      `SELECT o.*, d.nome AS departamentoNome
       FROM obrigacoes o
       LEFT JOIN departamentos d ON o.departamentoId = d.id
       WHERE o.empresaId = ?`,
      [empresaId]
    );

    const obrigaçõesComAtividades = await Promise.all(
      obrigações.map(async (ob) => {
        const [atividades] = await db.query(
          `SELECT id, tipo, texto, descricao, tipoCancelamento, ordem 
           FROM atividades_obrigacao 
           WHERE obrigacao_id = ?
           ORDER BY ordem`,
          [ob.id]
        );
        return { ...ob, atividades };
      })
    );

    res.json(obrigaçõesComAtividades);
  } catch (err) {
    console.error("Erro ao buscar obrigações com atividades:", err);
    res.status(500).json({ erro: "Erro ao buscar obrigações." });
  }
});

router.get("/cliente/:clienteId/atividades", verifyToken, async (req, res) => {
  const { clienteId } = req.params;

  try {
    const [atividades] = await db.query(`
      SELECT a.*, o.nome AS nomeObrigacao
      FROM obrigacoes_atividades_clientes a
      JOIN obrigacoes_clientes oc ON a.obrigacaoClienteId = oc.id
      JOIN obrigacoes o ON oc.obrigacaoId = o.id
      WHERE a.clienteId = ? AND oc.status != 'cancelada'
      ORDER BY a.obrigacaoClienteId, a.ordem
    `, [clienteId]);

    res.json(atividades);
  } catch (err) {
    console.error("Erro ao buscar atividades do cliente:", err);
    res.status(500).json({ erro: "Erro ao buscar atividades do cliente." });
  }
});

router.get("/empresa/:empresaId/geradas", verifyToken, async (req, res) => {
  const { empresaId } = req.params;
  const { mes, ano } = req.query;

  console.log("📌 Empresa:", empresaId, "Ano:", ano, "Mês:", mes);

  try {
    const [dados] = await db.query(
      `SELECT 
  oc.*, 
  c.nome AS cliente_nome, 
  c.status AS status_cliente,  -- 👈 Aqui está o novo campo
  d.nome AS departamento_nome
FROM obrigacoes_clientes oc
JOIN clientes c ON c.id = oc.clienteId
JOIN obrigacoes o ON o.id = oc.obrigacaoId
LEFT JOIN departamentos d ON o.departamentoId = d.id
WHERE c.empresaId = ? AND oc.status != 'cancelada' AND (
  oc.ano_referencia > ? OR 
  (oc.ano_referencia = ? AND oc.mes_referencia >= ?)
)`, [empresaId, ano, ano, mes]);

    res.json(dados);
  } catch (error) {
    console.error("Erro ao buscar obrigações geradas:", error);
    res.status(500).json({ error: "Erro ao buscar obrigações geradas." });
  }
});



router.get("/empresa/:empresaId/geradas/painel", verifyToken, async (req, res) => {
  const { empresaId } = req.params;
  const { usuarioId, filtrosAtivos, mes, ano } = req.query; // ✅ Parâmetros para filtrar por responsabilidade e mês/ano
  
  // ✅ Verificar se usuário é superadmin
  const isSuperadmin = req.usuario?.permissoes?.adm?.includes('superadmin');
  
  // ✅ Não aplicar filtro de responsabilidade se:
  // 1. Usuário é superadmin OU
  // 2. Há filtros de grupos/clientes/departamentos ativos
  const aplicarFiltroResponsabilidade = usuarioId && !isSuperadmin && filtrosAtivos !== 'true';
  

  // Função para subtrair dias (úteis ou corridos)

  function addDias(data, dias) {
    const dt = new Date(data);
    dt.setDate(dt.getDate() + dias);
    return dt;
  }

  try {
    // ✅ QUERY DINÂMICA: Filtra por responsabilidade quando usuarioId é fornecido
    let query = `
      SELECT 
        oc.id,
        oc.nome AS assunto,
        oc.status,
        oc.vencimento,
        oc.dataBaixa,
        oc.baixadaAutomaticamente,
        c.nome AS cliente_nome, 
        c.cnpjCpf AS cliente_cnpj,
        c.status AS status_cliente,
        o.nome AS nomeObrigacao,
        o.metaQtdDias,
        o.metaTipoDias,
        o.acaoQtdDias,
        o.acaoTipoDias,
        d.nome AS departamento_nome,
        oc.ano_referencia,
        oc.mes_referencia
      FROM obrigacoes_clientes oc
      JOIN clientes c ON c.id = oc.clienteId
      JOIN obrigacoes o ON o.id = oc.obrigacaoId
      LEFT JOIN departamentos d ON o.departamentoId = d.id`;
    
    let params = [empresaId];
    
    if (aplicarFiltroResponsabilidade) {
      // ✅ LEFT JOIN para incluir obrigações sem responsáveis + filtro por usuário
      query += `
      LEFT JOIN obrigacoes_clientes_responsaveis ocr ON ocr.obrigacaoClienteId = oc.id`;
    }
    
    query += `
      WHERE c.empresaId = ? AND oc.status != 'cancelada'`;
    
    // ✅ Filtro por mês e ano para obrigações concluídas
    if (mes && ano) {
      const mesNum = parseInt(mes) + 1; // JavaScript usa 0-11, SQL usa 1-12
      const anoNum = parseInt(ano);
      query += ` AND (
        oc.status != 'concluida' OR 
        (oc.status = 'concluida' AND MONTH(oc.dataBaixa) = ? AND YEAR(oc.dataBaixa) = ?)
      )`;
      params.push(mesNum, anoNum);
    }
    
    if (aplicarFiltroResponsabilidade) {
      // ✅ Buscar departamento do usuário logado
      const [usuarioDept] = await db.query(`
        SELECT re.departamentoId 
        FROM relacao_empresas re 
        WHERE re.usuarioId = ? AND re.empresaId = ?
      `, [usuarioId, empresaId]);
      
      const departamentoUsuario = usuarioDept[0]?.departamentoId;
      
      if (departamentoUsuario) {
        // ✅ Filtro: responsabilidade do usuário OU obrigações sem responsáveis do mesmo departamento OU obrigações esporádicas com responsável direto
        query += ` AND (ocr.usuarioId = ? OR (ocr.usuarioId IS NULL AND o.departamentoId = ?) OR (o.frequencia = 'Esporádica' AND oc.responsavelId = ?))`;
        params.push(usuarioId, departamentoUsuario, usuarioId);
        console.log(`👥 [Obrigações Painel] Usuário departamento: ${departamentoUsuario}, incluindo obrigações órfãs do mesmo dept e esporádicas`);
      } else {
        // ✅ Usuário sem departamento: suas responsabilidades OU obrigações esporádicas com responsável direto
        query += ` AND (ocr.usuarioId = ? OR (o.frequencia = 'Esporádica' AND oc.responsavelId = ?))`;
        params.push(usuarioId, usuarioId);
        console.log(`👤 [Obrigações Painel] Usuário sem departamento, responsabilidades diretas e esporádicas`);
      }
    }
    
    query += `
      ORDER BY d.nome, oc.vencimento`;

    if (aplicarFiltroResponsabilidade) {
      console.log(`👤 [Obrigações Painel] Filtro aplicado para usuário ID: ${usuarioId}`);
    }

    const [obr] = await db.query(query, params);

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const painel = {};

    for (const ob of obr) {
      const depto = ob.departamento_nome || "Sem Departamento";
      const vencimento = new Date(ob.vencimento);
      vencimento.setHours(0, 0, 0, 0);

      // Para obrigações esporádicas, usar os valores salvos diretamente
      let meta, dataAcao;
      if (ob.acao && ob.meta) {
        meta = new Date(ob.meta);
        dataAcao = new Date(ob.acao);
      } else {
        // Para obrigações regulares, calcular baseado nos parâmetros
        meta = subtrairDias(vencimento, ob.metaQtdDias || 0, ob.metaTipoDias || "Dias úteis");
        dataAcao = subtrairDias(meta, ob.acaoQtdDias || 0, ob.acaoTipoDias || "Dias úteis");
      }
      meta.setHours(0, 0, 0, 0);
      dataAcao.setHours(0, 0, 0, 0);

      const status = (ob.status || "pendente").trim().toLowerCase();
      const baixadaAutomaticamente = ob.baixadaAutomaticamente === 1;
      const dataConclusao = ob.dataBaixa ? new Date(ob.dataBaixa) : null;
      if (dataConclusao) dataConclusao.setHours(0, 0, 0, 0);

      // Painel estático: processa todas as obrigações
      const isMesSelecionado = true; // Sempre true para processar todas

      // Adiciona dataMeta e dataAcao ao objeto da tarefa para o frontend
      const tarefaDetalhada = {
        ...ob,
        dataMeta: meta.toISOString().slice(0, 10),
        dataAcao: dataAcao.toISOString().slice(0, 10),
        cliente_cnpj: ob.cliente_cnpj || "",
      };

      if (!painel[depto]) {
        painel[depto] = {
          departamento: depto,
          acao: { proximos15dias: 0, programadoHoje: 0, foraProgramado: 0, tarefas: [] },
          atencao: { aposMeta: 0, venceHoje: 0, aposPrazo: 0, tarefas: [] },
          concluidas: { finalizada: 0, naProgramacao: 0, concluidasAposMetaPrazo: 0, tarefas: [] },
        };
      }

      // -- CATEGORIZAÇÃO --

      // Finalizada automática (só do mês selecionado)
      if (baixadaAutomaticamente && isMesSelecionado) {
        painel[depto].concluidas.finalizada++;
        painel[depto].concluidas.tarefas.push({ ...tarefaDetalhada, categoria: "Finalizada" });
        continue;
      }

      // CONCLUÍDAS (só do mês selecionado)
      if (status === "concluida" && isMesSelecionado) {
        if (dataConclusao) {
          // Nova lógica: "Na Programação" se conclusão <= dataAcao OU (conclusão > dataAcao e <= meta)
          if (
            (dataConclusao.getTime() === dataAcao.getTime() &&
             dataConclusao.getTime() === meta.getTime() &&
             dataConclusao.getTime() === vencimento.getTime())
            ||
            (dataConclusao <= dataAcao && dataConclusao <= meta && dataConclusao <= vencimento)
            ||
            (dataConclusao > dataAcao && dataConclusao <= meta)
          ) {
            painel[depto].concluidas.naProgramacao++;
            painel[depto].concluidas.tarefas.push({ ...tarefaDetalhada, categoria: "Na Programação" });
          } else if (
            dataConclusao > meta &&
            dataConclusao <= vencimento
          ) {
            painel[depto].concluidas.concluidasAposMetaPrazo++;
            painel[depto].concluidas.tarefas.push({ ...tarefaDetalhada, categoria: "Concluída Após Meta" });
          } else if (dataConclusao > vencimento) {
            painel[depto].concluidas.concluidasAposMetaPrazo++;
            painel[depto].concluidas.tarefas.push({ ...tarefaDetalhada, categoria: "Concluída Após Prazo" });
          } else {
            painel[depto].concluidas.finalizada++;
            painel[depto].concluidas.tarefas.push({ ...tarefaDetalhada, categoria: "Finalizada" });
          }
        } else {
          painel[depto].concluidas.finalizada++;
          painel[depto].concluidas.tarefas.push({ ...tarefaDetalhada, categoria: "Finalizada" });
        }
        continue;
      }

      // ATENÇÃO (TODAS as obrigações)
      if (vencimento.getTime() === hoje.getTime()) {
        painel[depto].atencao.venceHoje++;
        painel[depto].atencao.tarefas.push({ ...tarefaDetalhada, categoria: "Vence Hoje" });
        continue;
      }
      if (hoje > vencimento) {
        painel[depto].atencao.aposPrazo++;
        painel[depto].atencao.tarefas.push({ ...tarefaDetalhada, categoria: "Após Prazo" });
        continue;
      }
      if (hoje > meta && hoje < vencimento) {
        painel[depto].atencao.aposMeta++;
        painel[depto].atencao.tarefas.push({ ...tarefaDetalhada, categoria: "Após Meta" });
        continue;
      }

      // AÇÃO (TODAS as obrigações não vencidas)
      // Só classifica na seção AÇÃO se NÃO estiver vencida
      if (hoje <= vencimento) {
        if (dataAcao.getTime() === hoje.getTime()) {
          painel[depto].acao.programadoHoje++;
          painel[depto].acao.tarefas.push({ ...tarefaDetalhada, categoria: "Programado Hoje" });
        } else if (
          dataAcao > hoje &&
          dataAcao <= addDias(hoje, 15)
        ) {
          painel[depto].acao.proximos15dias++;
          painel[depto].acao.tarefas.push({ ...tarefaDetalhada, categoria: "Próximos 15 dias" });
        } else if (hoje > dataAcao) {
          painel[depto].acao.foraProgramado++;
          painel[depto].acao.tarefas.push({ ...tarefaDetalhada, categoria: "Fora do Programado" });
        }
      }
    }

    res.json(Object.values(painel));
  } catch (err) {
    console.error("Erro ao montar painel de obrigações:", err);
    res.status(500).json({ erro: "Erro interno ao montar painel de obrigações." });
  }
});




// Função para subtrair dias úteis (mantém a mesma)
function subtrairDiasUteisAteData(dataBase, qtd, cacheDiasUteis) {
  let idx = cacheDiasUteis.findIndex(d => d.toDateString() === new Date(dataBase).toDateString());
  if (idx === -1) idx = cacheDiasUteis.length - 1;
  const novoIdx = idx - qtd;
  return novoIdx >= 0 ? cacheDiasUteis[novoIdx] : cacheDiasUteis[0];
}



// Funções auxiliares (iguais ao seu código)
function getDiasUteisDoAno(ano) {
  const dias = [];
  let date = new Date(ano, 0, 1);
  while (date.getFullYear() === ano) {
    if (date.getDay() !== 0 && date.getDay() !== 6) dias.push(new Date(date));
    date.setDate(date.getDate() + 1);
  }
  return dias;
}

function subtrairDiasUteisAteData(dataBase, qtd, cacheDiasUteis) {
  let idx = cacheDiasUteis.findIndex(d => d.toDateString() === new Date(dataBase).toDateString());
  if (idx === -1) idx = cacheDiasUteis.length - 1;
  const novoIdx = idx - qtd;
  return novoIdx >= 0 ? cacheDiasUteis[novoIdx] : cacheDiasUteis[0];
}




// ROTAS NOVAS PARA PAINEL [ID] OBRIGAÇÕES!!

router.get("/cliente-obrigacao/:id", verifyToken, async (req, res) => {
  const { id } = req.params;

  try {
    const [dados] = await db.query(`
      SELECT 
        oc.*, 
        o.nome AS nomeObrigacao, 
        o.departamento_id AS departamentoId,
        o.acao_qtd_dias AS acaoQtdDias,
        o.meta_qtd_dias AS metaQtdDias,
        o.meta_tipo_dias AS metaTipoDias,
        o.vencimento_tipo AS vencimentoTipo,
        o.vencimento_dia AS vencimentoDia,
        o.fato_gerador AS fatoGerador,
        o.orgao,
        o.gera_multa AS geraMulta,
        o.usar_relatorio AS usarRelatorio,
        o.reenviar_email AS reenviarEmail,
        d.nome AS departamentoNome,
        c.razao_social AS clienteNome,
        c.cpf_cnpj AS clienteCnpjCpf,
        c.email_principal AS clienteEmail,
        u.nome AS responsavelNome,
        u.email AS responsavelEmail,
        uc.nome AS concluidoPorNome,
        uc.email AS concluidoPorEmail
      FROM obrigacoes_clientes oc
      JOIN obrigacoes o ON oc.obrigacao_id = o.id
      JOIN departamentos d ON o.departamento_id = d.id
      JOIN clientes c ON oc.cliente_id = c.id
      LEFT JOIN usuarios u ON oc.responsavel_id = u.id
      LEFT JOIN usuarios uc ON oc.concluido_por = uc.id
      WHERE oc.id = ?
    `, [id]);

    if (dados.length === 0) {
      return res.status(404).json({ error: "Obrigação gerada não encontrada." });
    }

    res.json(dados[0]);
  } catch (error) {
    console.error("Erro ao buscar obrigação do cliente:", error);
    res.status(500).json({ error: "Erro ao buscar dados da obrigação gerada." });
  }
});

// ✅ NOVO: Buscar competências adjacentes para navegação
router.get("/cliente/:clienteId/obrigacao/:obrigacaoId/competencias", verifyToken, async (req, res) => {
  const { clienteId, obrigacaoId } = req.params;

  try {
    const [competencias] = await db.query(`
      SELECT 
        oc.id,
        oc.ano_referencia,
        oc.mes_referencia,
        oc.vencimento,
        oc.status,
        oc.dataBaixa,
        CONCAT(oc.mes_referencia, '/', oc.ano_referencia) as competencia
      FROM obrigacoes_clientes oc
      WHERE oc.clienteId = ? AND oc.obrigacaoId = ?
      ORDER BY oc.ano_referencia ASC, oc.mes_referencia ASC
    `, [clienteId, obrigacaoId]);

    res.json(competencias);
  } catch (error) {
    console.error("Erro ao buscar competências adjacentes:", error);
    res.status(500).json({ error: "Erro ao buscar competências adjacentes." });
  }
});


router.get("/atividades-cliente/:obrigacaoClienteId", verifyToken, async (req, res) => {
  const { obrigacaoClienteId } = req.params;

  try {
    const [atividades] = await db.query(`
  SELECT 
    oac.*, 
    u1.nome AS concluidoPorNome,
    u2.nome AS canceladoPorNome,
    CASE 
      WHEN TRIM(oac.texto) = '0' THEN NULL 
      ELSE oac.texto 
    END AS texto
  FROM obrigacoes_atividades_clientes oac
  LEFT JOIN usuarios u1 ON oac.concluido_por = u1.id
  LEFT JOIN usuarios u2 ON oac.cancelado_por = u2.id
  WHERE oac.obrigacao_cliente_id = ?
  ORDER BY oac.ordem
`, [obrigacaoClienteId]);


    res.json(atividades);
  } catch (err) {
    console.error("Erro ao buscar atividades da obrigação cliente:", err);
    res.status(500).json({ error: "Erro ao buscar atividades." });
  }
});


// 📌 Concluir obrigação GERADA (obrigacoes_clientes)
router.patch("/:id/concluir", verifyToken, async (req, res) => {
  const { id } = req.params;
  const userId = req.usuario?.id; // ID do usuário que está concluindo

  try {
    // Verifica se a obrigação gerada existe
    const [obrigacaoRows] = await db.query(`SELECT * FROM obrigacoes_clientes WHERE id = ?`, [id]);
    const obrigacao = obrigacaoRows[0];

    if (!obrigacao) {
      return res.status(404).json({ error: "Obrigação não encontrada." });
    }

    // Busca as atividades vinculadas a essa obrigação gerada
    const [atividades] = await db.query(
      `SELECT * FROM obrigacoes_atividades_clientes WHERE obrigacaoClienteId = ?`,
      [id]
    );

    const todasFinalizadas = atividades.every((a) => a.concluida === 1 || a.cancelada === 1);

    if (!todasFinalizadas) {
      return res.status(400).json({ error: "Ainda existem atividades em aberto." });
    }

    // Marca a obrigação como concluída, incluindo quem concluiu
    const { dataHora } = getDataHoraServidor();

    await db.query(
      `UPDATE obrigacoes_clientes SET status = 'concluída', dataBaixa = ?, concluido_por = ? WHERE id = ?`,
      [dataHora, userId, id]
    );

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Erro ao concluir obrigação:", error);
    return res.status(500).json({ error: "Erro interno ao concluir obrigação." });
  }
});



router.patch("/atividade/:atividadeId/concluir", verifyToken, async (req, res) => {
  const { atividadeId } = req.params;
  const userId = req.usuario?.id; // vem do middleware de autenticação

  try {
    const { dataHora } = getDataHoraServidor();

    await db.query(`
      UPDATE obrigacoes_atividades_clientes
      SET concluida = 1, dataConclusao = ?, concluidoPor = ?
      WHERE id = ?
    `, [dataHora, userId, atividadeId]);

    res.json({ success: true });
  } catch (err) {
    console.error("Erro ao concluir atividade da obrigação:", err);
    res.status(500).json({ error: "Erro ao concluir atividade da obrigação." });
  }
});


router.patch("/:id/datas", async (req, res) => {
  const { id } = req.params;
  const {
    acaoQtdDias, acaoTipoDias,
    metaQtdDias, metaTipoDias,
    vencimentoTipo, vencimentoDia
  } = req.body;

  try {
    await db.query(`
      UPDATE obrigacoes
      SET acaoQtdDias = ?, acaoTipoDias = ?, metaQtdDias = ?, metaTipoDias = ?, vencimentoTipo = ?, vencimentoDia = ?
      WHERE id = ?`,
      [acaoQtdDias, acaoTipoDias, metaQtdDias, metaTipoDias, vencimentoTipo, vencimentoDia, id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error("Erro ao atualizar datas:", err);
    res.status(500).json({ error: "Erro ao atualizar datas." });
  }
});



router.post("/:obrigacaoId/comentario", verifyToken, async (req, res) => {
  const { obrigacaoId } = req.params;
  const { comentario, anexos, tipo } = req.body;
  const usuarioId = req.usuario?.id;

  if (!comentario?.trim() && (!anexos || anexos.length === 0)) {
    return res.status(400).json({ error: "Comentário ou anexo é obrigatório." });
  }

  try {
    // Ajusta para horário de Brasília (UTC-3)
    const agora = new Date();
    agora.setHours(agora.getHours() - 3); // Ajuste UTC-3
    const pad = n => String(n).padStart(2, "0");
    const criadoEm =
      agora.getFullYear() + "-" +
      pad(agora.getMonth() + 1) + "-" +
      pad(agora.getDate()) + " " +
      pad(agora.getHours()) + ":" +
      pad(agora.getMinutes()) + ":" +
      pad(agora.getSeconds());

    await db.query(`
  INSERT INTO comentarios_obrigacao (obrigacaoId, usuarioId, comentario, anexos, tipo, criadoEm)
  VALUES (?, ?, ?, ?, ?, ?)
`, [obrigacaoId, usuarioId, comentario || null, JSON.stringify(anexos || []), tipo || "usuario", criadoEm]);


    res.json({ success: true });
  } catch (err) {
    console.error("Erro ao adicionar comentário na obrigação:", err);
    res.status(500).json({ error: "Erro ao salvar comentário." });
  }
});


router.get("/:obrigacaoId/comentarios", verifyToken, async (req, res) => {
  const { obrigacaoId } = req.params;

  try {
    const [rows] = await db.query(`
     SELECT 
  co.id,
  co.comentario,
  co.criado_em AS criadoEm,
  co.anexos,
  co.tipo,
  u.nome AS autor,
  u.avatar_url AS avatar
      FROM comentarios_obrigacao co
      JOIN usuarios u ON co.usuario_id = u.id
      WHERE co.obrigacao_id = ?
      ORDER BY co.criado_em DESC
    `, [obrigacaoId]);

    // Parse do campo JSON
    const comentarios = rows.map(row => ({
      ...row,
      anexos: (() => {
        try {
          return row.anexos ? JSON.parse(row.anexos) : [];
        } catch (e) {
          console.warn("⚠️ Anexo inválido no comentário ID", row.id, ":", row.anexos);
          return [];
        }
      })()
    }));

    res.json(comentarios);
  } catch (err) {
    console.error("Erro ao buscar comentários:", err);
    res.status(500).json({ error: "Erro ao buscar comentários." });
  }
});


router.patch("/atividade/:atividadeId/cancelar", verifyToken, async (req, res) => {
  const { atividadeId } = req.params;
  const { justificativa } = req.body;
  const userId = req.usuario?.id;

  try {
    const [[atividade]] = await db.query(`
      SELECT tipoCancelamento FROM obrigacoes_atividades_clientes WHERE id = ?
    `, [atividadeId]);

    if (!atividade) {
      return res.status(404).json({ error: "Atividade não encontrada." });
    }

    if (atividade.tipoCancelamento === "Com justificativa" && (!justificativa || justificativa.trim() === "")) {
      return res.status(400).json({ error: "Justificativa obrigatória para esse tipo de atividade." });
    }

    // Data/hora padrão do servidor (Brasília)
    const { dataHora } = getDataHoraServidor();

    await db.query(`
      UPDATE obrigacoes_atividades_clientes
      SET cancelada = 1, dataCancelamento = ?, canceladoPor = ?, justificativa = ?
      WHERE id = ?
    `, [dataHora, userId, justificativa || null, atividadeId]);

    res.json({ success: true });
  } catch (err) {
    console.error("Erro ao cancelar atividade da obrigação:", err);
    res.status(500).json({ error: "Erro ao cancelar atividade." });
  }
});

router.get("/empresa/:empresaId/todas", verifyToken, async (req, res) => {
  const { empresaId } = req.params;
  const { usuarioId, filtrosAtivos } = req.query; // ✅ Parâmetros para filtrar por responsabilidade
  
  // ✅ Verificar se usuário é superadmin
  const isSuperadmin = req.usuario?.permissoes?.adm?.includes('superadmin');
  
  // ✅ Não aplicar filtro de responsabilidade se:
  // 1. Usuário é superadmin OU
  // 2. Há filtros de grupos/clientes/departamentos ativos
  const aplicarFiltroResponsabilidade = usuarioId && !isSuperadmin && filtrosAtivos !== 'true';
  
  
  try {
    // 1. ✅ BUSCA OBRIGAÇÕES COM FILTRO OPCIONAL POR RESPONSABILIDADE
    let query = `
      SELECT 
        oc.*, 
        c.nome AS cliente_nome, 
        c.status AS status_cliente,
        o.nome AS nomeObrigacao,
        o.departamentoId,
        d.nome AS departamento_nome,
        o.metaQtdDias, o.metaTipoDias, o.acaoQtdDias, o.acaoTipoDias
      FROM obrigacoes_clientes oc
      JOIN clientes c ON oc.clienteId = c.id
      JOIN obrigacoes o ON oc.obrigacaoId = o.id
      LEFT JOIN departamentos d ON o.departamentoId = d.id`;
    
    let params = [empresaId];
    
    if (aplicarFiltroResponsabilidade) {
      // ✅ LEFT JOIN para incluir obrigações sem responsáveis + filtro por usuário
      query += `
      LEFT JOIN obrigacoes_clientes_responsaveis ocr ON ocr.obrigacaoClienteId = oc.id`;
    }
    
    query += `
      WHERE c.empresaId = ? AND oc.status != 'cancelada'`;
    
    if (aplicarFiltroResponsabilidade) {
      // ✅ Buscar departamento do usuário logado
      const [usuarioDept] = await db.query(`
        SELECT re.departamentoId 
        FROM relacao_empresas re 
        WHERE re.usuarioId = ? AND re.empresaId = ?
      `, [usuarioId, empresaId]);
      
      const departamentoUsuario = usuarioDept[0]?.departamentoId;
      
      if (departamentoUsuario) {
        // ✅ Filtro: responsabilidade do usuário OU obrigações sem responsáveis do mesmo departamento OU obrigações esporádicas com responsável direto
        query += ` AND (ocr.usuarioId = ? OR (ocr.usuarioId IS NULL AND o.departamentoId = ?) OR (o.frequencia = 'Esporádica' AND oc.responsavelId = ?))`;
        params.push(usuarioId, departamentoUsuario, usuarioId);
        console.log(`👥 [Obrigações Todas] Usuário departamento: ${departamentoUsuario}, incluindo obrigações órfãs do mesmo dept e esporádicas`);
      } else {
        // ✅ Usuário sem departamento: suas responsabilidades OU obrigações esporádicas com responsável direto
        query += ` AND (ocr.usuarioId = ? OR (o.frequencia = 'Esporádica' AND oc.responsavelId = ?))`;
        params.push(usuarioId, usuarioId);
        console.log(`👤 [Obrigações Todas] Usuário sem departamento, responsabilidades diretas e esporádicas`);
      }
    }

    if (aplicarFiltroResponsabilidade) {
      console.log(`👤 [Obrigações Todas] Filtro aplicado para usuário ID: ${usuarioId}`);
    }

    const [obr] = await db.query(query, params);

    // Se não tem obrigações, retorna vazio
    if (obr.length === 0) return res.json([]);

    // 2. BUSCA TODAS AS ATIVIDADES EM LOTES (caso haja muitos registros)
    const idsObrigacao = obr.map(o => o.id);
    const lote = 500;
    const lotes = [];
    for (let i = 0; i < idsObrigacao.length; i += lote) {
      const idsLote = idsObrigacao.slice(i, i + lote);
      lotes.push(
        db.query(`
          SELECT id, concluida, cancelada, dataConclusao, obrigacaoClienteId
          FROM obrigacoes_atividades_clientes
          WHERE obrigacaoClienteId IN (?)
        `, [idsLote])
      );
    }
    const allResults = await Promise.all(lotes);
    let todasAtividades = allResults.flatMap(([ativLote]) => ativLote);

    // 3. BUSCA TODOS OS RESPONSÁVEIS DAS OBRIGAÇÕES
    // Primeiro busca da tabela obrigacoes_clientes_responsaveis
    const [responsaveisTabelaRelacao] = await db.query(`
      SELECT 
        ocr.obrigacaoClienteId,
        ocr.usuarioId,
        u.nome AS responsavelNome,
        u.email AS responsavelEmail
      FROM obrigacoes_clientes_responsaveis ocr
      JOIN usuarios u ON u.id = ocr.usuarioId
      WHERE ocr.obrigacaoClienteId IN (?)
    `, [idsObrigacao]);

    // Buscar obrigações com frequência "Esporádica" que não têm responsáveis na tabela de relação
    const [obrigacoesEsporadicas] = await db.query(`
      SELECT oc.id as obrigacaoClienteId
      FROM obrigacoes_clientes oc
      JOIN obrigacoes o ON o.id = oc.obrigacaoId
      WHERE oc.id IN (?) AND o.frequencia = 'Esporádica' AND oc.responsavelId IS NOT NULL
    `, [idsObrigacao]);

    // Buscar responsáveis diretos das obrigações esporádicas
    let responsaveisEsporadicos = [];
    if (obrigacoesEsporadicas.length > 0) {
      const idsEsporadicas = obrigacoesEsporadicas.map(o => o.obrigacaoClienteId);
      const [responsaveisDiretos] = await db.query(`
        SELECT 
          oc.id as obrigacaoClienteId,
          oc.responsavelId as usuarioId,
          u.nome AS responsavelNome,
          u.email AS responsavelEmail
        FROM obrigacoes_clientes oc
        JOIN usuarios u ON u.id = oc.responsavelId
        WHERE oc.id IN (?)
      `, [idsEsporadicas]);
      responsaveisEsporadicos = responsaveisDiretos;
    }

    // Combinar os dois resultados
    const responsaveis = [...responsaveisTabelaRelacao, ...responsaveisEsporadicos];

    // 4. MAPEIA AS ATIVIDADES PELO obrigacaoClienteId
    const atividadesPorObrigacao = {};
    for (const atv of todasAtividades) {
      if (!atividadesPorObrigacao[atv.obrigacaoClienteId]) {
        atividadesPorObrigacao[atv.obrigacaoClienteId] = [];
      }
      atividadesPorObrigacao[atv.obrigacaoClienteId].push(atv);
    }

    // 5. MAPEIA OS RESPONSÁVEIS PELO obrigacaoClienteId
    const responsaveisPorObrigacao = {};
    for (const resp of responsaveis) {
      if (!responsaveisPorObrigacao[resp.obrigacaoClienteId]) {
        responsaveisPorObrigacao[resp.obrigacaoClienteId] = [];
      }
      responsaveisPorObrigacao[resp.obrigacaoClienteId].push(resp);
    }

    // 6. MONTA O OBJETO FINAL COM O CÁLCULO DE META/AÇÃO
    const obrigacoesComAtividades = obr.map(ob => {
      const atividades = atividadesPorObrigacao[ob.id] || [];
      const responsaveisObrigacao = responsaveisPorObrigacao[ob.id] || [];
      let concluida = false;
      let dataEntregaFinal = null;

      if (ob.baixadaAutomaticamente === 1) {
        concluida = true;
      } else {
        concluida = atividades.length === 0 || atividades.every(a => a.concluida === 1);
        // Pega a maior dataConclusao das concluídas
        const datasEntrega = atividades
          .filter(a => a.concluida === 1 && a.dataConclusao)
          .map(a => new Date(a.dataConclusao));
        if (datasEntrega.length) {
          dataEntregaFinal = datasEntrega.sort((a, b) => b - a)[0];
        }
      }

      // Cálculo das datas meta/ação baseadas no vencimento e nos parâmetros
      const vencimento = ob.vencimento || ob.data_vencimento;
      let dataMeta = null, dataAcao = null;
      
      // Verificar se tem acao e meta preenchidos (não null, não vazio, não undefined)
      const temAcaoPreenchida = ob.acao && ob.acao !== null && ob.acao !== '' && ob.acao !== 'null';
      const temMetaPreenchida = ob.meta && ob.meta !== null && ob.meta !== '' && ob.meta !== 'null';
      
      if (temAcaoPreenchida && temMetaPreenchida) {
        // Usar os valores salvos diretamente
        dataAcao = ob.acao;
        dataMeta = ob.meta;
      } else if (vencimento && ob.metaQtdDias != null && ob.metaTipoDias) {
        // Calcular baseado nos parâmetros
        const metaDate = subtrairDias(new Date(vencimento), Number(ob.metaQtdDias), ob.metaTipoDias);
        dataMeta = metaDate.toISOString().slice(0, 10);
        if (ob.acaoQtdDias != null && ob.acaoTipoDias) {
          const acaoDate = subtrairDias(metaDate, Number(ob.acaoQtdDias), ob.acaoTipoDias);
          dataAcao = acaoDate.toISOString().slice(0, 10);
        }
      }

      // --- CLASSIFICAÇÃO DE CATEGORIA ---
      let categoria = "Não Concluída";
      const dataVencimento = vencimento ? new Date(vencimento) : null;
      if (concluida) {
        if (dataEntregaFinal && dataVencimento && dataEntregaFinal > dataVencimento) {
          categoria = "Concluída Após Prazo";
        } else {
          categoria = "Na Programação";
        }
      }
      else if (dataEntregaFinal && dataMeta && dataEntregaFinal > new Date(dataMeta) && dataEntregaFinal <= dataVencimento) {
        categoria = "Concluída Após Meta";
      }

      // --- CLASSIFICAÇÃO VENCE HOJE ---
      const hoje = new Date();
      hoje.setHours(0,0,0,0);
      if (!concluida && dataVencimento) {
        const dataVenc = new Date(dataVencimento);
        dataVenc.setHours(0,0,0,0);
        if (dataVenc.getTime() === hoje.getTime()) {
          categoria = "Vence Hoje";
        }
      }

      return {
        ...ob,
        atividades,
        responsaveis: responsaveisObrigacao,
        concluida,
        dataEntregaFinal,
        categoria,
        tipo: "obrigacao",
        dataMeta,
        dataAcao,
        // Se quiser um boolean:
        venceHoje: categoria === "Vence Hoje",
      };
    });

    res.json(obrigacoesComAtividades);
  } catch (err) {
    console.error("Erro ao buscar todas as obrigações:", err);
    res.status(500).json({ erro: "Erro ao buscar obrigações." });
  }
});


// 📌 DESCANCELAR atividade
router.patch("/atividade/:atividadeId/descancelar", verifyToken, async (req, res) => {
  const { atividadeId } = req.params;
  const userId = req.usuario?.id;

  try {
    const [result] = await db.query(
      `UPDATE obrigacoes_atividades_clientes 
       SET cancelada = 0, justificativa = NULL, concluidoPor = NULL, dataCancelamento = NULL
       WHERE id = ?`,
      [atividadeId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Atividade não encontrada." });
    }

    res.json({ success: true });
  } catch (err) {
    console.error("Erro ao descancelar atividade da obrigação:", err);
    res.status(500).json({ error: "Erro ao descancelar atividade." });
  }
});


router.patch("/:id/desconcluir", verifyToken, async (req, res) => {
  const { id } = req.params;

  try {
    const [result] = await db.query(`
  UPDATE obrigacoes_clientes
  SET dataBaixa = NULL
  WHERE id = ?
`, [id]);

    res.json({ success: true });
  } catch (err) {
    console.error("Erro ao desconcluir obrigação:", err);
    res.status(500).json({ error: "Erro ao desconcluir obrigação." });
  }
});

router.patch("/atividade/:atividadeId/anexo", verifyToken, async (req, res) => {
  const { atividadeId } = req.params;
  const { base64, nomeArquivo } = req.body;

  try {
    // Se ainda não existir, crie essa coluna no banco:
    // ALTER TABLE obrigacoes_atividades_clientes ADD COLUMN anexo TEXT;
    // ALTER TABLE obrigacoes_atividades_clientes ADD COLUMN nomeArquivo TEXT;

    await db.query(`
      UPDATE obrigacoes_atividades_clientes
      SET anexo = ?, nomeArquivo = ?
      WHERE id = ?
    `, [base64, nomeArquivo, atividadeId]);

    res.json({ success: true });
  } catch (err) {
    console.error("Erro ao salvar anexo na atividade:", err);
    res.status(500).json({ error: "Erro ao salvar anexo na atividade." });
  }
});

router.get("/empresa/:empresaId/esporadicas", verifyToken, async (req, res) => {
  const { empresaId } = req.params;

  try {
    const [dados] = await db.query(`
      SELECT o.*, d.nome as departamentoNome
      FROM obrigacoes o
      JOIN departamentos d ON o.departamentoId = d.id
      WHERE o.empresaId = ? AND o.frequencia = 'Esporadica'
    `, [empresaId]);

    res.json(dados);
  } catch (error) {
    console.error("Erro ao buscar obrigações esporádicas:", error);
    res.status(500).json({ error: "Erro ao buscar obrigações esporádicas." });
  }
});

router.post("/esporadica/criar-tarefa", verifyToken, async (req, res) => {
  const {
    obrigacaoId,
    clienteId,
    dataAcao,
    dataMeta,
    dataVencimento,
    parcelas,
    fatoGerador,
    andamento,
    responsavelId,
    convidados = []
  } = req.body;

  const userId = req.usuario?.id;



  try {
    // Buscar a obrigação base
    const [[obrigacao]] = await db.query(
      `SELECT nome FROM obrigacoes WHERE id = ?`,
      [obrigacaoId]
    );

    if (!obrigacao) {
      return res.status(404).json({ error: "Obrigação não encontrada." });
    }

    const dtVenc = new Date(dataVencimento);
    const parcelasCount = Number(parcelas) || 1;

    let ultimaObrigacaoId = null;
    
    for (let i = 0; i < parcelasCount; i++) {
      const venc = new Date(dtVenc);
      venc.setMonth(venc.getMonth() + i);

      const ano = venc.getFullYear();
      const mes = venc.getMonth() + 1;



      const [resInsert] = await db.query(
        `INSERT INTO obrigacoes_clientes 
  (cliente_id, obrigacao_id, nome, descricao, status, ano_referencia, mes_referencia, 
   vencimento, responsavel_id, acao, meta)
   VALUES (?, ?, ?, ?, 'pendente', ?, ?, ?, ?, ?, ?)`,
        [
          clienteId,
          obrigacaoId,
          obrigacao.nome, // <-- nome base
          `Obrigação esporádica ${obrigacao.nome} - ${mes}/${ano}`,
          ano,
          mes,
          venc.toISOString().split("T")[0],
          responsavelId || null,
          dataAcao,
          dataMeta,
        ]
      );

      const obrigacaoClienteId = resInsert.insertId;
      ultimaObrigacaoId = obrigacaoClienteId; // Armazena o ID da última obrigação criada

      // Clonar atividades base
      const [atividadesBase] = await db.query(
        `SELECT * FROM atividades_obrigacao WHERE obrigacaoId = ? ORDER BY ordem`,
        [obrigacaoId]
      );

      // Verificar se já existem atividades para esta obrigação do cliente
      const [atividadesExistentes] = await db.query(`
        SELECT id FROM obrigacoes_atividades_clientes 
        WHERE cliente_id = ? AND obrigacao_cliente_id = ?
      `, [clienteId, obrigacaoClienteId]);
      
      // Se já existem atividades, não inserir novamente
      if (atividadesExistentes.length > 0) {
        console.log(`⚠️ Atividades já existem para cliente ${clienteId}, obrigação ${obrigacaoClienteId}. Pulando inserção.`);
      } else {
        for (const atv of atividadesBase) {
          await db.query(
            `INSERT INTO obrigacoes_atividades_clientes 
            (cliente_id, obrigacao_cliente_id, tipo, texto, descricao, tipo_cancelamento, ordem)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              clienteId,
              obrigacaoClienteId,
              atv.tipo,
              atv.texto,
              atv.descricao,
              atv.tipoCancelamento,
              atv.ordem
            ]
          );
        }
        console.log(`✅ Inseridas ${atividadesBase.length} atividades para cliente ${clienteId}, obrigação ${obrigacaoClienteId}`);
      }

      // Inserir convidados, se houver
      for (const convidadoId of convidados) {
        await db.query(
          `INSERT INTO obrigacoes_clientes_convidados 
           (obrigacaoClienteId, usuarioId)
           VALUES (?, ?)`,
          [obrigacaoClienteId, convidadoId]
        );
      }

      // Inserir comentário de andamento, se fornecido
      if (andamento && andamento.trim()) {
        await db.query(
          `INSERT INTO comentarios_obrigacao 
           (obrigacaoId, usuarioId, comentario, tipo)
           VALUES (?, ?, ?, 'usuario')`,
          [obrigacaoClienteId, userId, andamento.trim()]
        );
      }
    }

    res.status(201).json({ 
      success: true, 
      obrigacaoClienteId: ultimaObrigacaoId 
    });
  } catch (err) {
    console.error("Erro ao criar tarefa esporádica:", err);
    res.status(500).json({ error: "Erro ao criar tarefa esporádica." });
  }
});








// Rota para disparar a baixa automática da DCTFWeb para um cliente e empresa específicos
router.post("/baixar/dctfweb", verifyToken, async (req, res) => {
  const { empresaId, clienteId, ano, mes } = req.body;

  if (!empresaId || !clienteId || !ano || !mes) {
    return res.status(400).json({ error: "empresaId, clienteId, ano e mes são obrigatórios." });
  }

  try {
    // Chama a função que faz a consulta/transmissão da DCTFWeb
    const sucesso = await consultarDCTFWeb(empresaId, clienteId, "40", ano, mes); // "40" pode ser categoria fixa ou variável conforme necessário

    if (sucesso) {
      // Ajusta para horário de Brasília (UTC-3)
      const agora = new Date();
      agora.setHours(agora.getHours() - 3); // Ajusta para horário de Brasília (UTC-3)
      const pad = n => String(n).padStart(2, "0");
      const dataBaixa =
        agora.getFullYear() + "-" +
        pad(agora.getMonth() + 1) + "-" +
        pad(agora.getDate()) + " " +
        pad(agora.getHours()) + ":" +
        pad(agora.getMinutes()) + ":" +
        pad(agora.getSeconds());

      // Atualize no banco a obrigação_clientes para refletir baixa automática
      await db.query(`
        UPDATE obrigacoes_clientes 
        SET status = 'concluida', baixadaAutomaticamente = 1, dataBaixa = ? 
        WHERE empresaId = ? AND clienteId = ? AND ano_referencia = ? AND mes_referencia = ?
      `, [dataBaixa, empresaId, clienteId, ano, mes]);

      return res.json({ message: "Baixa automática DCTFWeb realizada com sucesso." });
    } else {
      return res.status(500).json({ error: "Falha na baixa automática da DCTFWeb." });
    }
  } catch (error) {
    console.error("Erro na baixa automática DCTFWeb:", error);
    res.status(500).json({ error: "Erro interno ao realizar baixa automática." });
  }
});


router.post("/:id/gerar-atividades-cliente", verifyToken, async (req, res) => {
  const obrigacaoId = Number(req.params.id);
  const { ano, mesInicio, mesFim, clienteId } = req.body;
  if (!clienteId) return res.status(400).json({ error: "clienteId é obrigatório" });

  // 1. Buscar a obrigação e atividades base
  const [[obrigacao]] = await db.query(`SELECT * FROM obrigacoes WHERE id = ?`, [obrigacaoId]);
  if (!obrigacao) return res.status(404).json({ error: "Obrigação não encontrada." });

  const [atividadesBase] = await db.query(
    `SELECT * FROM atividades_obrigacao WHERE obrigacaoId = ?`,
    [obrigacaoId]
  );

  // 2. Só roda para o cliente informado
  for (let mes = mesInicio; mes <= mesFim; mes++) {
    const diasNoMes = new Date(ano, mes, 0).getDate();
    for (let dia = 1; dia <= diasNoMes; dia++) {
      const data = new Date(ano, mes - 1, dia);
      const weekday = data.getDay();
      if (weekday === 0 || weekday === 6) continue; // só dias úteis

      try {
        // Checa se já existe, se quiser evitar duplicidade
        const [existe] = await db.query(`
          SELECT id FROM obrigacoes_clientes
          WHERE cliente_id = ? AND obrigacao_id = ? AND ano_referencia = ? AND mes_referencia = ? AND vencimento = ?
        `, [clienteId, obrigacaoId, ano, mes, data.toISOString().split("T")[0]]);
        if (existe.length) continue;

        // Cria a obrigação do cliente
        // Ajusta para horário de Brasília (UTC-3)
        const agora = new Date();
        agora.setHours(agora.getHours() - 3); // Ajusta para horário de Brasília (UTC-3)
        const pad = n => String(n).padStart(2, "0");
        const dataCriacao =
          agora.getFullYear() + "-" +
          pad(agora.getMonth() + 1) + "-" +
          pad(agora.getDate()) + " " +
          pad(agora.getHours()) + ":" +
          pad(agora.getMinutes()) + ":" +
          pad(agora.getSeconds());

        const [res] = await db.query(`
          INSERT INTO obrigacoes_clientes
          (clienteId, obrigacaoId, nome, descricao, status, ano_referencia, mes_referencia, vencimento, dataCriacao)
          VALUES (?, ?, ?, ?, 'pendente', ?, ?, ?, ?)`,
          [
            clienteId,
            obrigacaoId,
            obrigacao.nome, // <-- nome base
            `Obrigacao ${obrigacao.nome} de ${dia}/${mes}/${ano}`,
            ano,
            mes,
            data.toISOString().split("T")[0],
            dataCriacao,
          ]
        );

        // Clona as atividades base para o cliente
        if (atividadesBase.length > 0) {
          // Verificar se já existem atividades para esta obrigação do cliente
          const [atividadesExistentes] = await db.query(`
            SELECT id FROM obrigacoes_atividades_clientes 
            WHERE cliente_id = ? AND obrigacao_cliente_id = ?
          `, [clienteId, res.insertId]);
          
          // Se já existem atividades, não inserir novamente
          if (atividadesExistentes.length > 0) {
            console.log(`⚠️ Atividades já existem para cliente ${clienteId}, obrigação ${res.insertId}. Pulando inserção.`);
          } else {
            const values = atividadesBase.map(atv => [
              clienteId,
              res.insertId,
              atv.tipo,
              atv.texto,
              atv.descricao,
              atv.tipoCancelamento,
              atv.ordem,
            ]);
            const placeholders = values.map(() => "(?, ?, ?, ?, ?, ?, ?)").join(", ");
            const flatValues = values.flat();

            await db.query(`
              INSERT INTO obrigacoes_atividades_clientes
              (clienteId, obrigacaoClienteId, tipo, texto, descricao, tipoCancelamento, ordem)
              VALUES ${placeholders}
            `, flatValues);
            
            console.log(`✅ Inseridas ${atividadesBase.length} atividades para cliente ${clienteId}, obrigação ${res.insertId}`);
          }
        }
      } catch (err) {
        if (!err.message?.includes("Duplicate")) {
          console.error("Erro ao inserir tarefa diária:", err);
        }
      }
    }
  }
  res.status(200).json({ ok: true });
});


// ================= RESPONSÁVEL FIXO GLOBAL =================

/**
 * GET responsável fixo global de uma obrigação
 * Exemplo: GET /api/obrigacoes/:obrigacaoId/responsavel-fixo
 */
router.get('/:obrigacaoId/responsavel-fixo', verifyToken, async (req, res) => {
  const { obrigacaoId } = req.params;
  try {
    const [[resp]] = await db.query(
      `SELECT DISTINCT orc.usuarioId, u.nome, u.email FROM obrigacoes_responsaveis_cliente orc
       JOIN usuarios u ON u.id = orc.usuarioId
       WHERE orc.obrigacaoId = ? AND orc.clienteId IS NULL`,
      [obrigacaoId]
    );
    if (!resp) return res.json(null);
    res.json(resp);
  } catch (err) {
    console.error('Erro ao buscar responsável fixo global:', err);
    res.status(500).json({ error: 'Erro ao buscar responsável fixo global.' });
  }
});

/**
 * POST responsável fixo global de uma obrigação
 * Exemplo: POST /api/obrigacoes/:obrigacaoId/responsavel-fixo { usuarioId }
 */
router.post('/:obrigacaoId/responsavel-fixo', verifyToken, async (req, res) => {
  const { obrigacaoId } = req.params;
  const { usuarioId } = req.body;
  if (!usuarioId) return res.status(400).json({ error: 'usuarioId é obrigatório.' });
  try {
    // Upsert: remove se já existe, insere novo
    await db.query('DELETE FROM obrigacoes_responsaveis_cliente WHERE obrigacaoId = ? AND clienteId IS NULL', [obrigacaoId]);
    await db.query('INSERT INTO obrigacoes_responsaveis_cliente (obrigacaoId, clienteId, usuarioId) VALUES (?, NULL, ?)', [obrigacaoId, usuarioId]);
    res.json({ success: true, message: 'Responsável fixo global definido.' });
  } catch (err) {
    console.error('Erro ao definir responsável fixo global:', err);
    res.status(500).json({ error: 'Erro ao definir responsável fixo global.' });
  }
});

/**
 * DELETE responsável fixo global de uma obrigação
 * Exemplo: DELETE /api/obrigacoes/:obrigacaoId/responsavel-fixo
 */
router.delete('/:obrigacaoId/responsavel-fixo', verifyToken, async (req, res) => {
  const { obrigacaoId } = req.params;
  try {
    await db.query('DELETE FROM obrigacoes_responsaveis_cliente WHERE obrigacaoId = ? AND clienteId IS NULL', [obrigacaoId]);
    res.json({ success: true, message: 'Responsável fixo global removido.' });
  } catch (err) {
    console.error('Erro ao remover responsável fixo global:', err);
    res.status(500).json({ error: 'Erro ao remover responsável fixo global.' });
  }
});

// ================= RESPONSÁVEL FIXO POR CLIENTE =================

/**
 * GET responsável fixo de um cliente para uma obrigação
 * Exemplo: GET /api/obrigacoes/:obrigacaoId/clientes/:clienteId/responsavel-fixo
 */
router.get('/:obrigacaoId/clientes/:clienteId/responsavel-fixo', verifyToken, async (req, res) => {
  const { obrigacaoId, clienteId } = req.params;
  try {
    const [[resp]] = await db.query(
      `SELECT DISTINCT rc.usuarioId, u.nome, u.email FROM obrigacoes_responsaveis_cliente rc
       JOIN usuarios u ON u.id = rc.usuarioId
       WHERE rc.obrigacaoId = ? AND rc.clienteId = ?`,
      [obrigacaoId, clienteId]
    );
    if (!resp) return res.json(null);
    res.json(resp);
  } catch (err) {
    console.error('Erro ao buscar responsável fixo do cliente:', err);
    res.status(500).json({ error: 'Erro ao buscar responsável fixo do cliente.' });
  }
});

/**
 * POST responsável fixo de um cliente para uma obrigação
 * Exemplo: POST /api/obrigacoes/:obrigacaoId/clientes/:clienteId/responsavel-fixo { usuarioId }
 */
router.post('/:obrigacaoId/clientes/:clienteId/responsavel-fixo', verifyToken, async (req, res) => {
  const { obrigacaoId, clienteId } = req.params;
  const { usuarioId } = req.body;
  if (!usuarioId) return res.status(400).json({ error: 'usuarioId é obrigatório.' });
  try {
    // Usando INSERT ... ON DUPLICATE KEY UPDATE para evitar duplicatas
    await db.query(
      `INSERT INTO obrigacoes_responsaveis_cliente (obrigacaoId, clienteId, usuarioId) 
       VALUES (?, ?, ?) 
       ON DUPLICATE KEY UPDATE usuarioId = ?`,
      [obrigacaoId, clienteId, usuarioId, usuarioId]
    );
    res.json({ success: true, message: 'Responsável fixo do cliente definido.' });
  } catch (err) {
    console.error('Erro ao definir responsável fixo do cliente:', err);
    res.status(500).json({ error: 'Erro ao definir responsável fixo do cliente.' });
  }
});

/**
 * DELETE responsável fixo de um cliente para uma obrigação
 * Exemplo: DELETE /api/obrigacoes/:obrigacaoId/clientes/:clienteId/responsavel-fixo
 */
router.delete('/:obrigacaoId/clientes/:clienteId/responsavel-fixo', verifyToken, async (req, res) => {
  const { obrigacaoId, clienteId } = req.params;
  try {
    await db.query('DELETE FROM obrigacoes_responsaveis_cliente WHERE obrigacaoId = ? AND clienteId = ?', [obrigacaoId, clienteId]);
    res.json({ success: true, message: 'Responsável fixo do cliente removido.' });
  } catch (err) {
    console.error('Erro ao remover responsável fixo do cliente:', err);
    res.status(500).json({ error: 'Erro ao remover responsável fixo do cliente.' });
  }
});

// ================= CLIENTES COM RESPONSÁVEL (GLOBAL OU INDIVIDUAL) =================

/**
 * GET /api/obrigacoes/:obrigacaoId/clientes-com-responsavel
 * Retorna todos os clientes vinculados à obrigação, com responsável resolvido (individual > global > null)
 */
router.get('/:obrigacaoId/clientes-com-responsavel', verifyToken, async (req, res) => {
  const { obrigacaoId } = req.params;
  try {
    // Buscar particularidades da obrigação
    const [partRows] = await db.query(`
      SELECT particularidadeId, tipo FROM obrigacoes_particularidades WHERE obrigacaoId = ?
    `, [obrigacaoId]);
    const partE = partRows.filter(p => p.tipo === 'E').map(p => p.particularidadeId);
    const partOU = partRows.filter(p => p.tipo === 'OU').map(p => p.particularidadeId);
    const partEXCETO = partRows.filter(p => p.tipo === 'EXCETO').map(p => p.particularidadeId);

    // Buscar todos os clientes que responderam alguma particularidade dessa obrigação
    const particularidadeIds = partRows.map(p => p.particularidadeId);
    
    // Se não há particularidades, retorna array vazio
    if (particularidadeIds.length === 0) {
      return res.json([]);
    }
    
    const [clientes] = await db.query(`
      SELECT c.id, c.nome, c.cnpjCpf
      FROM clientes c
      JOIN cliente_respostas cr ON cr.clienteId = c.id
      JOIN enquete_respostas er ON er.id = cr.respostaId
      WHERE er.particularidadeId IN (?)
      GROUP BY c.id
    `, [particularidadeIds]);

    if (clientes.length === 0) return res.json([]);

    // Buscar todas as particularidades respondidas por cada cliente
    const clienteIds = clientes.map(c => c.id);
    const [respostas] = await db.query(`
      SELECT c.id as clienteId, er.particularidadeId
      FROM clientes c
      JOIN cliente_respostas cr ON cr.clienteId = c.id
      JOIN enquete_respostas er ON er.id = cr.respostaId
      WHERE c.id IN (?) AND er.particularidadeId IN (?)
    `, [clienteIds, particularidadeIds]);

    // Mapear particularidades por cliente
    const partPorCliente = {};
    for (const r of respostas) {
      if (!partPorCliente[r.clienteId]) partPorCliente[r.clienteId] = new Set();
      partPorCliente[r.clienteId].add(r.particularidadeId);
    }

    // Filtrar clientes válidos
    const clientesValidos = clientes.filter(c => {
      const parts = partPorCliente[c.id] || new Set();
      // EXCETO: se tiver qualquer EXCETO, exclui
      if (partEXCETO.some(pid => parts.has(pid))) return false;
      // E: se não tiver todas as E, exclui
      if (partE.length > 0 && !partE.every(pid => parts.has(pid))) return false;
      // OU: se houver OU, precisa ter pelo menos uma
      if (partOU.length > 0 && !partOU.some(pid => parts.has(pid))) return false;
      return true;
    });

    // Buscar responsáveis individuais para esses clientes
    let responsaveisIndividuais = [];
    if (clientesValidos.length > 0) {
      const [rows] = await db.query(`
        SELECT rc.clienteId, u.id as usuarioId, u.nome, u.email
        FROM obrigacoes_responsaveis_cliente rc
        JOIN usuarios u ON u.id = rc.usuarioId
        WHERE rc.obrigacaoId = ? AND rc.clienteId IN (?)
      `, [obrigacaoId, clientesValidos.map(c => c.id)]);
      responsaveisIndividuais = rows;
    }
    const responsavelIndMap = new Map();
    for (const r of responsaveisIndividuais) {
      responsavelIndMap.set(r.clienteId, { id: r.usuarioId, nome: r.nome, email: r.email });
    }

    // Buscar responsável global (se houver) - clienteId = null
    const [[globalResp]] = await db.query(`
      SELECT u.id, u.nome, u.email
      FROM obrigacoes_responsaveis_cliente orc
      JOIN usuarios u ON u.id = orc.usuarioId
      WHERE orc.obrigacaoId = ? AND orc.clienteId IS NULL
    `, [obrigacaoId]);
    const responsavelGlobal = globalResp ? { id: globalResp.id, nome: globalResp.nome, email: globalResp.email } : null;

    // Montar resposta
    const resultado = clientesValidos.map(c => ({
      id: c.id,
      nome: c.nome,
      cnpjCpf: c.cnpjCpf,
      responsavel: responsavelIndMap.get(c.id) || responsavelGlobal || null
    }));

    res.json(resultado);
  } catch (err) {
    console.error('Erro ao buscar clientes com responsável:', err);
    res.status(500).json({ error: 'Erro ao buscar clientes com responsável.' });
  }
});

// Cancelar obrigação principal
router.patch('/:id/cancelar', verifyToken, async (req, res) => {
  const { id } = req.params;
  const { justificativa } = req.body;

  try {
    // Verifica se a obrigação existe
    const [[obrigacao]] = await db.query(
      `SELECT id, status FROM obrigacoes_clientes WHERE id = ?`,
      [id]
    );

    if (!obrigacao) {
      return res.status(404).json({ error: "Obrigação não encontrada." });
    }

    if (obrigacao.status === 'cancelada') {
      return res.status(400).json({ error: "Obrigação já está cancelada." });
    }

    // Ajusta para horário de Brasília (UTC-3)
    const agora = new Date();
    agora.setHours(agora.getHours() - 3);
    const pad = n => String(n).padStart(2, "0");
    const dataCancelamento =
      agora.getFullYear() + "-" +
      pad(agora.getMonth() + 1) + "-" +
      pad(agora.getDate()) + " " +
      pad(agora.getHours()) + ":" +
      pad(agora.getMinutes()) + ":" +
      pad(agora.getSeconds());

    await db.query(
      `UPDATE obrigacoes_clientes 
       SET status = 'cancelada', dataCancelamento = ?
       WHERE id = ?`,
      [dataCancelamento || null, id]
    );

    res.json({ success: true, message: "Obrigação cancelada com sucesso." });
  } catch (err) {
    console.error("Erro ao cancelar obrigação:", err);
    res.status(500).json({ error: "Erro interno ao cancelar obrigação." });
  }
});

// Reabrir obrigação cancelada
router.patch('/:id/reabrir', verifyToken, async (req, res) => {
  const { id } = req.params;

  try {
    // Verifica se a obrigação existe e está cancelada
    const [[obrigacao]] = await db.query(
      `SELECT id, status FROM obrigacoes_clientes WHERE id = ?`,
      [id]
    );

    if (!obrigacao) {
      return res.status(404).json({ error: "Obrigação não encontrada." });
    }

    if (obrigacao.status !== 'cancelada') {
      return res.status(400).json({ error: "Obrigação não está cancelada." });
    }

    await db.query(
      `UPDATE obrigacoes_clientes 
       SET status = 'pendente', dataCancelamento = NULL
       WHERE id = ?`,
      [id]
    );

    res.json({ success: true, message: "Obrigação reaberta com sucesso." });
  } catch (err) {
    console.error("Erro ao reabrir obrigação:", err);
    res.status(500).json({ error: "Erro interno ao reabrir obrigação." });
  }
});

// 📌 DISCONCLUIR atividade (desfazer conclusão)
router.patch("/atividade/:atividadeId/disconcluir", verifyToken, async (req, res) => {
  const { atividadeId } = req.params;
  const userId = req.usuario?.id;

  try {
    const [result] = await db.query(
      `UPDATE obrigacoes_atividades_clientes 
       SET concluida = 0, dataConclusao = NULL, concluidoPor = NULL
       WHERE id = ?`,
      [atividadeId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Atividade não encontrada." });
    }

    res.json({ success: true });
  } catch (err) {
    console.error("Erro ao desconcluir atividade da obrigação:", err);
    res.status(500).json({ error: "Erro ao desconcluir atividade." });
  }
});

// ================= TEMPLATES DE E-MAIL =================

/**
 * GET /api/obrigacoes/atividades/:atividadeId/email-template
 * Busca template de e-mail de uma atividade
 */
router.get('/atividades/:atividadeId/email-template', verifyToken, async (req, res) => {
  const { atividadeId } = req.params;
  
  console.log("🔍 [BACKEND] Buscando template para atividadeId:", atividadeId);
  
  try {
    // ✅ PRIMEIRO: Verificar se o ID é da atividade base (atividades_obrigacao) ou da atividade cliente
    let atividadeBaseId = null;
    let atividadeCliente = null;
    
    // Tentar buscar como atividade base primeiro
    const [[atividadeBaseCheck]] = await db.query(`
      SELECT id, tipo, texto FROM atividades_obrigacao WHERE id = ?
    `, [atividadeId]);
    
    if (atividadeBaseCheck) {
      console.log("✅ [BACKEND] ID é da atividade base:", atividadeBaseCheck);
      atividadeBaseId = atividadeBaseCheck.id;
      atividadeCliente = { tipo: atividadeBaseCheck.tipo, texto: atividadeBaseCheck.texto };
    } else {
      // Se não for atividade base, buscar como atividade cliente
      const [[atividadeClienteCheck]] = await db.query(`
        SELECT tipo, texto FROM obrigacoes_atividades_clientes WHERE id = ?
      `, [atividadeId]);
      
      console.log("🔍 [BACKEND] Atividade cliente encontrada:", atividadeClienteCheck);
      
      if (!atividadeClienteCheck) {
        console.log("❌ [BACKEND] Atividade não encontrada nem como base nem como cliente");
        return res.json(null);
      }
      
      atividadeCliente = atividadeClienteCheck;
    }
    
    // Se ainda não temos o atividadeBaseId, precisamos buscar
    if (!atividadeBaseId) {
      // Buscar a obrigação do cliente para obter o obrigacaoId
      const [[obrigacaoCliente]] = await db.query(`
        SELECT obrigacaoId FROM obrigacoes_clientes oc
        JOIN obrigacoes_atividades_clientes oac ON oc.id = oac.obrigacaoClienteId
        WHERE oac.id = ?
      `, [atividadeId]);
      
      console.log("🔍 [BACKEND] Obrigação cliente encontrada:", obrigacaoCliente);
      
      if (!obrigacaoCliente) {
        console.log("❌ [BACKEND] Obrigação cliente não encontrada");
        return res.json(null);
      }
      
      // Buscar todas as atividades base que correspondem e verificar qual é a correta
      const [atividadesBase] = await db.query(`
        SELECT id, ordem FROM atividades_obrigacao 
        WHERE obrigacao_id = ? AND tipo = ? AND texto = ?
        ORDER BY ordem
      `, [obrigacaoCliente.obrigacaoId, atividadeCliente.tipo, atividadeCliente.texto]);
      
      console.log("🔍 [BACKEND] Atividades base encontradas:", atividadesBase);
      console.log("🔍 [BACKEND] Buscando com obrigacaoId:", obrigacaoCliente.obrigacaoId);
      console.log("🔍 [BACKEND] Buscando com tipo:", atividadeCliente.tipo);
      console.log("🔍 [BACKEND] Buscando com texto:", atividadeCliente.texto);
      
      if (atividadesBase.length === 0) {
        console.log("❌ [BACKEND] Nenhuma atividade base encontrada");
        return res.json(null);
      }
      
      // SELEÇÃO DA ATIVIDADE BASE CORRETA: 
      // Se há múltiplas atividades base, precisamos identificar qual corresponde a esta atividade do cliente
      let atividadeBase = atividadesBase[0]; // Por padrão, pegar a primeira
      
      // Se há múltiplas atividades base, tentar encontrar a correta baseada na ordem
      if (atividadesBase.length > 1) {
        // Buscar a ordem da atividade do cliente para tentar fazer match
        const [[atividadeClienteComOrdem]] = await db.query(`
          SELECT ordem FROM obrigacoes_atividades_clientes WHERE id = ?
        `, [atividadeId]);
        
        if (atividadeClienteComOrdem && atividadeClienteComOrdem.ordem) {
          // Tentar encontrar atividade base com ordem similar
          const atividadeBaseCorrespondente = atividadesBase.find(ab => ab.ordem === atividadeClienteComOrdem.ordem);
          if (atividadeBaseCorrespondente) {
            atividadeBase = atividadeBaseCorrespondente;
          }
        }
      }
      
      atividadeBaseId = atividadeBase.id;
    }
    
    // Buscar template usando o ID da atividade base
    const [[template]] = await db.query(`
      SELECT * FROM obrigacoes_email_templates WHERE atividadeId = ?
    `, [atividadeBaseId]);
    
    console.log("🔍 [BACKEND] Template encontrado:", template);
    console.log("🔍 [BACKEND] Buscando template para atividadeBaseId:", atividadeBaseId);
    
    // VERIFICAÇÃO FINAL: Só retornar template se realmente existir
    if (!template) {
      console.log("❌ [BACKEND] Template não encontrado na tabela obrigacoes_email_templates");
      return res.json(null);
    }
    
    console.log("✅ [BACKEND] Template retornado com sucesso");
    res.json(template);
  } catch (err) {
    console.error('Erro ao buscar template de e-mail:', err);
    res.status(500).json({ error: 'Erro ao buscar template de e-mail.' });
  }
});

/**
 * POST /api/obrigacoes/atividades/:atividadeId/email-template
 * Cria/atualiza template de e-mail de uma atividade
 */
router.post('/atividades/:atividadeId/email-template', verifyToken, async (req, res) => {
  const { atividadeId } = req.params;
  const { nome, assunto, corpo, destinatario, cc, co, variaveis } = req.body;
  
  console.log("🔍 [BACKEND POST] Salvando template para atividadeId:", atividadeId);
  console.log("🔍 [BACKEND POST] Dados recebidos:", { nome, assunto, corpo, destinatario, cc, co, variaveis });
  
  try {
    // ✅ PRIMEIRO: Verificar se o ID é da atividade base (atividades_obrigacao) ou da atividade cliente
    let atividadeBaseId = null;
    let atividadeCliente = null;
    
    // Tentar buscar como atividade base primeiro
    const [[atividadeBaseCheck]] = await db.query(`
      SELECT id, tipo, texto FROM atividades_obrigacao WHERE id = ?
    `, [atividadeId]);
    
    if (atividadeBaseCheck) {
      console.log("✅ [BACKEND POST] ID é da atividade base:", atividadeBaseCheck);
      atividadeBaseId = atividadeBaseCheck.id;
      atividadeCliente = { tipo: atividadeBaseCheck.tipo, texto: atividadeBaseCheck.texto };
    } else {
      // Se não for atividade base, buscar como atividade cliente
      const [[atividadeClienteCheck]] = await db.query(`
        SELECT tipo, texto FROM obrigacoes_atividades_clientes WHERE id = ?
      `, [atividadeId]);
      
      console.log("🔍 [BACKEND POST] Atividade cliente encontrada:", atividadeClienteCheck);
      
      if (!atividadeClienteCheck) {
        console.log("❌ [BACKEND POST] Atividade não encontrada nem como base nem como cliente");
        return res.status(404).json({ error: 'Atividade não encontrada.' });
      }
      
      atividadeCliente = atividadeClienteCheck;
    }
    
    // Se ainda não temos o atividadeBaseId, precisamos buscar
    if (!atividadeBaseId) {
      // Buscar a obrigação do cliente para obter o obrigacaoId
      const [[obrigacaoCliente]] = await db.query(`
        SELECT obrigacaoId FROM obrigacoes_clientes oc
        JOIN obrigacoes_atividades_clientes oac ON oc.id = oac.obrigacaoClienteId
        WHERE oac.id = ?
      `, [atividadeId]);
      
      if (!obrigacaoCliente) {
        return res.status(404).json({ error: 'Obrigação do cliente não encontrada.' });
      }
      
      // Buscar diretamente o ID da atividade base usando obrigacaoId + tipo + texto
      const [[atividadeBase]] = await db.query(`
        SELECT id FROM atividades_obrigacao 
        WHERE obrigacao_id = ? AND tipo = ? AND texto = ?
      `, [obrigacaoCliente.obrigacaoId, atividadeCliente.tipo, atividadeCliente.texto]);
      
      console.log("🔍 [BACKEND POST] Atividade base encontrada:", atividadeBase);
      console.log("🔍 [BACKEND POST] Buscando com obrigacaoId:", obrigacaoCliente.obrigacaoId);
      console.log("🔍 [BACKEND POST] Buscando com tipo:", atividadeCliente.tipo);
      console.log("🔍 [BACKEND POST] Buscando com texto:", atividadeCliente.texto);
      
      if (!atividadeBase) {
        console.log("❌ [BACKEND POST] Atividade base não encontrada");
        return res.status(404).json({ error: 'Atividade base não encontrada.' });
      }
      
      atividadeBaseId = atividadeBase.id;
    }
    
    console.log("🔍 [BACKEND POST] Usando atividadeBaseId para salvar:", atividadeBaseId);
    
    // ✅ Validar variáveis usadas no template
    const todasVariaveis = [];
    if (assunto) todasVariaveis.push(...extrairVariaveis(assunto));
    if (corpo) todasVariaveis.push(...extrairVariaveis(corpo));
    if (destinatario) todasVariaveis.push(...extrairVariaveis(destinatario));
    if (cc) todasVariaveis.push(...extrairVariaveis(cc));
    if (co) todasVariaveis.push(...extrairVariaveis(co));
    
    const variaveisUnicas = [...new Set(todasVariaveis)];
    const variaveisInvalidas = [];
    
    // Verificar se todas as variáveis usadas são válidas
    for (const variavel of variaveisUnicas) {
      if (!validarVariavel(variavel, variaveis)) {
        variaveisInvalidas.push(variavel);
      }
    }
    
    // Se há variáveis inválidas, retornar erro
    if (variaveisInvalidas.length > 0) {
      return res.status(400).json({ 
        error: 'Variáveis inválidas encontradas no template',
        variaveisInvalidas,
        message: `As seguintes variáveis não são válidas: ${variaveisInvalidas.join(', ')}`
      });
    }
    
    // Verificar se já existe template
    const [[existente]] = await db.query(`
      SELECT id FROM obrigacoes_email_templates WHERE atividadeId = ?
    `, [atividadeBaseId]);
    
    if (existente) {
      // Atualizar
      console.log("🔄 [BACKEND POST] Atualizando template existente para atividadeBaseId:", atividadeBaseId);
      await db.query(`
        UPDATE obrigacoes_email_templates 
        SET nome = ?, assunto = ?, corpo = ?, destinatario = ?, cc = ?, co = ?, variaveis = ?
        WHERE atividadeId = ?
      `, [nome, assunto, corpo, destinatario, cc, co, JSON.stringify(variaveis), atividadeBaseId]);
    } else {
      // Criar novo
      console.log("➕ [BACKEND POST] Criando novo template para atividadeBaseId:", atividadeBaseId);
      await db.query(`
        INSERT INTO obrigacoes_email_templates 
        (atividadeId, nome, assunto, corpo, destinatario, cc, co, variaveis)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [atividadeBaseId, nome, assunto, corpo, destinatario, cc, co, JSON.stringify(variaveis)]);
    }
    
    console.log("✅ [BACKEND POST] Template salvo com sucesso para atividadeBaseId:", atividadeBaseId);
    
    res.json({ 
      success: true,
      message: 'Template salvo com sucesso',
      variaveisUsadas: variaveisUnicas,
      totalVariaveis: variaveisUnicas.length
    });
  } catch (err) {
    console.error('Erro ao salvar template de e-mail:', err);
    res.status(500).json({ error: 'Erro ao salvar template de e-mail.' });
  }
});



/**
 * POST /api/obrigacoes/excluir-em-lote
 * Exclusão em lote de obrigações
 */
router.post("/excluir-em-lote", verifyToken, async (req, res) => {
  try {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: "IDs das obrigações são obrigatórios" });
    }

    // Excluir obrigações em lote
    const placeholders = ids.map(() => "?").join(",");
    const [result] = await db.execute(
      `DELETE FROM obrigacoes_clientes WHERE id IN (${placeholders})`,
      ids
    );

    console.log(`✅ ${result.affectedRows} obrigações excluídas em lote`);

    res.json({ 
      success: true, 
      message: `${result.affectedRows} obrigação(ões) excluída(s) com sucesso`,
      excluidas: result.affectedRows
    });
  } catch (error) {
    console.error("Erro ao excluir obrigações em lote:", error);
    res.status(500).json({ error: "Erro interno ao excluir obrigações" });
  }
});

/**
 * POST /api/obrigacoes/atualizar-responsavel-em-lote
 * Atualizar responsável exclusivo em lote
 */
router.post("/atualizar-responsavel-em-lote", verifyToken, async (req, res) => {
  const { ids, responsavelId } = req.body;
  
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'IDs são obrigatórios e devem ser um array não vazio.' });
  }
  
  if (!responsavelId) {
    return res.status(400).json({ error: 'responsavelId é obrigatório.' });
  }

  try {
    // Verificar se o responsável existe
    const [[responsavel]] = await db.query('SELECT id, nome FROM usuarios WHERE id = ?', [responsavelId]);
    if (!responsavel) {
      return res.status(404).json({ error: 'Responsável não encontrado.' });
    }

    // Obter uma conexão para transação
    const connection = await db.getConnection();
    
    try {
      // Iniciar transação
      await connection.beginTransaction();

      // 1. Atualizar responsável exclusivo em obrigacoes_clientes
      const placeholders = ids.map(() => "?").join(",");
      const [resultObrigacoes] = await connection.execute(
        `UPDATE obrigacoes_clientes SET responsavelId = ? WHERE id IN (${placeholders})`,
        [responsavelId, ...ids]
      );

      // 2. ATUALIZAR (não inserir) obrigacoes_clientes_responsaveis
      const [resultResponsaveis] = await connection.execute(
        `UPDATE obrigacoes_clientes_responsaveis SET usuarioId = ? WHERE obrigacaoClienteId IN (${placeholders})`,
        [responsavelId, ...ids]
      );

      // Commit da transação
      await connection.commit();

      console.log(`✅ Responsável atualizado em ambas as tabelas:`);
      console.log(`   - obrigacoes_clientes: ${resultObrigacoes.affectedRows} registros`);
      console.log(`   - obrigacoes_clientes_responsaveis: ${resultResponsaveis.affectedRows} registros atualizados`);

      res.json({ 
        success: true, 
        message: `Responsável atualizado com sucesso para ${resultObrigacoes.affectedRows} obrigação(ões).`,
        responsavel: responsavel.nome,
        atualizadas: resultObrigacoes.affectedRows,
        responsaveisAtualizados: resultResponsaveis.affectedRows
      });

    } catch (err) {
      // Rollback em caso de erro
      await connection.rollback();
      throw err;
    } finally {
      // Sempre liberar a conexão
      connection.release();
    }

  } catch (err) {
    console.error('Erro ao atualizar responsável em lote:', err);
    res.status(500).json({ error: 'Erro ao atualizar responsável em lote.' });
  }
});

// Listar modelo PDF Layout vinculado à atividade
router.get("/atividades/:id/pdf-layouts", verifyToken, async (req, res) => {
  const { id } = req.params;
  console.log("[BACK PDF Vincular][GET] atividadeId:", id);
  try {
    const [[atividade]] = await db.query(
      `SELECT pdf_layout_id FROM atividades_obrigacao WHERE id = ?`,
      [id]
    );
    console.log("[BACK PDF Vincular][GET] resultado atividade:", atividade);
    if (!atividade) return res.status(404).json({ erro: "Atividade não encontrada" });
    if (!atividade.pdf_layout_id) return res.json([]);
    const [[modelo]] = await db.query(
      `SELECT id, nome FROM pdf_layouts WHERE id = ?`,
      [atividade.pdf_layout_id]
    );
    console.log("[BACK PDF Vincular][GET] resultado modelo:", modelo);
    if (!modelo) return res.json([]);
    res.json([modelo]);
  } catch (err) {
    console.error("Erro ao buscar modelo PDF vinculado:", err);
    res.status(500).json({ erro: "Erro ao buscar modelo PDF vinculado" });
  }
});

// POST vincular modelo
router.post("/atividades/:id/pdf-layouts", verifyToken, async (req, res) => {
  const { id } = req.params;
  const { pdf_layout_id } = req.body;
  console.log("[BACK PDF Vincular][POST] atividadeId:", id, "layoutId:", pdf_layout_id);
  if (!pdf_layout_id) return res.status(400).json({ erro: "pdf_layout_id é obrigatório" });
  try {
    const [[atividade]] = await db.query(
      `SELECT id FROM atividades_obrigacao WHERE id = ?`,
      [id]
    );
    console.log("[BACK PDF Vincular][POST] resultado atividade:", atividade);
    if (!atividade) return res.status(404).json({ erro: "Atividade não encontrada" });
    await db.query(
      `UPDATE atividades_obrigacao SET pdf_layout_id = ? WHERE id = ?`,
      [pdf_layout_id, id]
    );
    res.json({ sucesso: true });
  } catch (err) {
    console.error("Erro ao vincular modelo PDF:", err);
    res.status(500).json({ erro: "Erro ao vincular modelo PDF" });
  }
});

// DELETE desvincular modelo
router.delete("/atividades/:id/pdf-layouts/:layoutId", verifyToken, async (req, res) => {
  const { id, layoutId } = req.params;
  console.log("[BACK PDF Vincular][DELETE] atividadeId:", id, "layoutId:", layoutId);
  try {
    const [[atividade]] = await db.query(
      `SELECT pdf_layout_id FROM atividades_obrigacao WHERE id = ?`,
      [id]
    );
    console.log("[BACK PDF Vincular][DELETE] resultado atividade:", atividade);
    if (!atividade) return res.status(404).json({ erro: "Atividade não encontrada" });
    if (atividade.pdf_layout_id != layoutId) return res.status(404).json({ erro: "Modelo não vinculado a esta atividade" });
    await db.query(
      `UPDATE atividades_obrigacao SET pdf_layout_id = NULL WHERE id = ? AND pdf_layout_id = ?`,
      [id, layoutId]
    );
    res.json({ sucesso: true });
  } catch (err) {
    console.error("Erro ao desvincular modelo PDF:", err);
    res.status(500).json({ erro: "Erro ao desvincular modelo PDF" });
  }
});

// ================= MÚLTIPLOS RESPONSÁVEIS =================
// Utiliza a tabela obrigacoes_responsaveis_cliente existente
// Permite múltiplos responsáveis por obrigação/cliente

/**
 * GET múltiplos responsáveis de uma obrigação para um cliente
 * Exemplo: GET /api/obrigacoes/:obrigacaoId/clientes/:clienteId/responsaveis
 */
router.get('/:obrigacaoId/clientes/:clienteId/responsaveis', verifyToken, async (req, res) => {
  const { obrigacaoId, clienteId } = req.params;
  try {
    const [responsaveis] = await db.query(`
      SELECT DISTINCT orc.id, orc.usuarioId, u.nome, u.email, d.nome as departamentoNome
      FROM obrigacoes_responsaveis_cliente orc
      JOIN usuarios u ON u.id = orc.usuarioId
      LEFT JOIN relacao_empresas re ON re.usuarioId = u.id
      LEFT JOIN departamentos d ON d.id = re.departamentoId
      WHERE orc.obrigacaoId = ? AND orc.clienteId = ?
      ORDER BY u.nome
    `, [obrigacaoId, clienteId]);
    
    res.json(responsaveis);
  } catch (err) {
    console.error('Erro ao buscar múltiplos responsáveis:', err);
    res.status(500).json({ error: 'Erro ao buscar responsáveis.' });
  }
});

/**
 * POST adicionar responsável múltiplo
 * Exemplo: POST /api/obrigacoes/:obrigacaoId/clientes/:clienteId/responsaveis { usuarioId }
 */
router.post('/:obrigacaoId/clientes/:clienteId/responsaveis', verifyToken, async (req, res) => {
  const { obrigacaoId, clienteId } = req.params;
  const { usuarioId } = req.body;
  
  if (!usuarioId) {
    return res.status(400).json({ error: 'usuarioId é obrigatório.' });
  }
  
  try {
    // Verificar se já existe
    const [existe] = await db.query(`
      SELECT obrigacaoId FROM obrigacoes_responsaveis_cliente 
      WHERE obrigacao_id = ? AND clienteId = ? AND usuarioId = ?
    `, [obrigacaoId, clienteId, usuarioId]);
    
    if (existe.length > 0) {
      return res.status(400).json({ error: 'Este responsável já está vinculado.' });
    }
    
    // Inserir novo responsável
    await db.query(`
      INSERT INTO obrigacoes_responsaveis_cliente (obrigacaoId, clienteId, usuarioId) 
      VALUES (?, ?, ?)
    `, [obrigacaoId, clienteId, usuarioId]);
    
    res.json({ success: true, message: 'Responsável adicionado com sucesso.' });
  } catch (err) {
    console.error('Erro ao adicionar responsável:', err);
    res.status(500).json({ error: 'Erro ao adicionar responsável.' });
  }
});

/**
 * DELETE remover responsável múltiplo
 * Exemplo: DELETE /api/obrigacoes/:obrigacaoId/clientes/:clienteId/responsaveis/:responsavelId
 */
router.delete('/:obrigacaoId/clientes/:clienteId/responsaveis/:responsavelId', verifyToken, async (req, res) => {
  const { obrigacaoId, clienteId, responsavelId } = req.params;
  
  try {
    await db.query(`
      DELETE FROM obrigacoes_responsaveis_cliente 
      WHERE obrigacao_id = ? AND clienteId = ? AND usuarioId = ?
    `, [obrigacaoId, clienteId, responsavelId]);
    
    res.json({ success: true, message: 'Responsável removido com sucesso.' });
  } catch (err) {
    console.error('Erro ao remover responsável:', err);
    res.status(500).json({ error: 'Erro ao remover responsável.' });
  }
});

/**
 * GET responsáveis múltiplos para uma obrigação (todos os clientes)
 * Exemplo: GET /api/obrigacoes/:obrigacaoId/responsaveis-multiplos
 */
router.get('/:obrigacaoId/responsaveis-multiplos', verifyToken, async (req, res) => {
  const { obrigacaoId } = req.params;
  
  try {
    const [responsaveis] = await db.query(`
      SELECT 
        orc.id, 
        orc.clienteId,
        orc.usuarioId,
        c.nome as clienteNome,
        c.cnpjCpf as clienteCnpj,
        u.nome as responsavelNome,
        u.email as responsavelEmail,
        d.nome as departamentoNome
      FROM obrigacoes_responsaveis_cliente orc
      JOIN clientes c ON c.id = orc.clienteId
      JOIN usuarios u ON u.id = orc.usuarioId
      LEFT JOIN relacao_empresas re ON re.usuarioId = u.id
      LEFT JOIN departamentos d ON d.id = re.departamentoId
      WHERE orc.obrigacaoId = ?
      ORDER BY c.nome, u.nome
    `, [obrigacaoId]);
    
    res.json(responsaveis);
  } catch (err) {
    console.error('Erro ao buscar responsáveis múltiplos:', err);
    res.status(500).json({ error: 'Erro ao buscar responsáveis.' });
  }
});

// Endpoint para buscar responsáveis de uma tarefa específica
router.get("/obrigacoes-clientes/:obrigacaoClienteId/responsaveis", verifyToken, async (req, res) => {
  const { obrigacaoClienteId } = req.params;
  
  try {
    // Primeiro, buscar informações da obrigação para verificar a frequência
    const [obrigacaoInfo] = await db.query(`
      SELECT oc.obrigacao_id AS obrigacaoId, o.frequencia
      FROM obrigacoes_clientes oc
      JOIN obrigacoes o ON o.id = oc.obrigacao_id
      WHERE oc.id = ?
    `, [obrigacaoClienteId]);

    if (obrigacaoInfo.length === 0) {
      return res.status(404).json({ erro: "Obrigação não encontrada" });
    }

    const { obrigacaoId, frequencia } = obrigacaoInfo[0];
    let responsaveis = [];

    // 1. Buscar responsáveis da tabela obrigacoes_clientes_responsaveis (sempre)
    const [responsaveisTabelaRelacao] = await db.query(`
      SELECT 
        u.id,
        u.nome,
        u.email,
        d.nome as departamentoNome
      FROM obrigacoes_clientes_responsaveis ocr
      JOIN usuarios u ON u.id = ocr.usuarioId
      LEFT JOIN relacao_empresas re ON re.usuarioId = u.id
      LEFT JOIN departamentos d ON d.id = re.departamentoId
      WHERE ocr.obrigacaoClienteId = ?
      ORDER BY u.nome
    `, [obrigacaoClienteId]);

    responsaveis = responsaveisTabelaRelacao;

    // 2. Se frequência for "Esporádica" e não há responsáveis na tabela de relação, buscar da obrigacoes_clientes
    if (frequencia === "Esporádica" && responsaveis.length === 0) {
      const [responsavelDireto] = await db.query(`
        SELECT 
          u.id,
          u.nome,
          u.email,
          d.nome as departamentoNome
        FROM obrigacoes_clientes oc
        JOIN usuarios u ON u.id = oc.responsavelId
        LEFT JOIN relacao_empresas re ON re.usuarioId = u.id
        LEFT JOIN departamentos d ON d.id = re.departamentoId
        WHERE oc.id = ? AND oc.responsavelId IS NOT NULL
        ORDER BY u.nome
      `, [obrigacaoClienteId]);

      responsaveis = responsavelDireto;
    }
    
    res.json(responsaveis);
  } catch (error) {
    console.error("Erro ao buscar responsáveis da tarefa:", error);
    res.status(500).json({ erro: "Erro interno do servidor" });
  }
});

/**
 * POST criar comentário para obrigação
 * Exemplo: POST /api/obrigacoes/comentario
 */
router.post("/comentario", verifyToken, async (req, res) => {
  const { obrigacaoId, comentario, tipo = "usuario" } = req.body;
  const userId = req.usuario?.id;

  if (!obrigacaoId || !comentario) {
    return res.status(400).json({ error: "obrigacaoId e comentario são obrigatórios." });
  }

  try {
    // Verificar se a obrigação existe
    const [[obrigacao]] = await db.query(
      `SELECT id FROM obrigacoes_clientes WHERE id = ?`,
      [obrigacaoId]
    );

    if (!obrigacao) {
      return res.status(404).json({ error: "Obrigação não encontrada." });
    }

    // Inserir comentário
    const [result] = await db.query(
      `INSERT INTO comentarios_obrigacao (obrigacaoId, usuarioId, comentario, tipo) 
       VALUES (?, ?, ?, ?)`,
      [obrigacaoId, userId, comentario, tipo]
    );

    res.status(201).json({ 
      success: true, 
      comentarioId: result.insertId,
      message: "Comentário criado com sucesso." 
    });
  } catch (err) {
    console.error("Erro ao criar comentário:", err);
    res.status(500).json({ error: "Erro ao criar comentário." });
  }
});

/**
 * GET buscar comentários de uma obrigação
 * Exemplo: GET /api/obrigacoes/:obrigacaoId/comentarios
 */
router.get("/:obrigacaoId/comentarios", verifyToken, async (req, res) => {
  const { obrigacaoId } = req.params;

  try {
    const [comentarios] = await db.query(`
      SELECT 
        co.id,
        co.comentario,
        co.tipo,
        co.criadoEm,
        u.nome as usuarioNome,
        u.email as usuarioEmail
      FROM comentarios_obrigacao co
      JOIN usuarios u ON u.id = co.usuarioId
      WHERE co.obrigacaoId = ?
      ORDER BY co.criadoEm DESC
    `, [obrigacaoId]);

    res.json(comentarios);
  } catch (err) {
    console.error("Erro ao buscar comentários:", err);
    res.status(500).json({ error: "Erro ao buscar comentários." });
  }
});

/**
 * POST buscar comentários em lote para múltiplas obrigações
 * Exemplo: POST /api/obrigacoes/comentarios/lote
 */
router.post("/comentarios/lote", verifyToken, async (req, res) => {
  const { obrigacaoIds } = req.body;
  
  if (!obrigacaoIds || !Array.isArray(obrigacaoIds) || obrigacaoIds.length === 0) {
    return res.status(400).json({ error: "Lista de IDs de obrigações é obrigatória." });
  }

  try {
    // Buscar o último comentário de cada obrigação
    const placeholders = obrigacaoIds.map(() => '?').join(',');
    const [comentarios] = await db.query(`
      SELECT 
        co.obrigacaoId,
        co.id as comentarioId,
        co.comentario,
        co.tipo,
        co.criadoEm,
        u.nome as autorNome,
        u.id as autorId
      FROM comentarios_obrigacao co
      JOIN usuarios u ON co.usuarioId = u.id
      WHERE co.obrigacaoId IN (${placeholders})
      AND co.id = (
        SELECT MAX(co2.id) 
        FROM comentarios_obrigacao co2 
        WHERE co2.obrigacaoId = co.obrigacaoId
      )
      ORDER BY co.criadoEm DESC
    `, obrigacaoIds);

    // Organizar por obrigacaoId para facilitar o acesso
    const comentariosPorObrigacao = {};
    comentarios.forEach(comentario => {
      comentariosPorObrigacao[comentario.obrigacaoId] = comentario;
    });

    res.json(comentariosPorObrigacao);
  } catch (err) {
    console.error("Erro ao buscar comentários em lote:", err);
    res.status(500).json({ error: "Erro ao buscar comentários em lote." });
  }
});

// ================= RESPONSÁVEIS FIXOS GLOBAIS MÚLTIPLOS =================

/**
 * GET buscar responsáveis fixos globais de uma obrigação
 * Exemplo: GET /api/obrigacoes/:obrigacaoId/responsaveis-fixos-globais
 */
router.get('/:obrigacaoId/responsaveis-fixos-globais', verifyToken, async (req, res) => {
  const { obrigacaoId } = req.params;

  try {
    // Verificar se a obrigação existe
    const [[obrigacao]] = await db.query(
      'SELECT id FROM obrigacoes WHERE id = ?',
      [obrigacaoId]
    );

    if (!obrigacao) {
      return res.status(404).json({ error: 'Obrigação não encontrada' });
    }

    // Buscar responsáveis fixos globais (clienteId = null)
    const [responsaveis] = await db.query(`
      SELECT 
        orc.usuarioId,
        u.nome,
        u.email,
        d.nome as departamentoNome
      FROM obrigacoes_responsaveis_cliente orc
      JOIN usuarios u ON u.id = orc.usuarioId
      LEFT JOIN relacao_empresas re ON re.usuarioId = u.id
      LEFT JOIN departamentos d ON d.id = re.departamentoId
      WHERE orc.obrigacaoId = ? AND orc.clienteId IS NULL
      ORDER BY u.nome
    `, [obrigacaoId]);

    res.json(responsaveis);
  } catch (error) {
    console.error('Erro ao buscar responsáveis fixos globais:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * POST adicionar responsável fixo global
 * Exemplo: POST /api/obrigacoes/:obrigacaoId/responsaveis-fixos-globais { usuarioId }
 */
router.post('/:obrigacaoId/responsaveis-fixos-globais', verifyToken, async (req, res) => {
  const { obrigacaoId } = req.params;
  const { usuarioId } = req.body;

  if (!usuarioId) {
    return res.status(400).json({ error: 'usuarioId é obrigatório' });
  }

  try {
    // Verificar se a obrigação existe
    const [[obrigacao]] = await db.query(
      'SELECT id FROM obrigacoes WHERE id = ?',
      [obrigacaoId]
    );

    if (!obrigacao) {
      return res.status(404).json({ error: 'Obrigação não encontrada' });
    }

    // Verificar se o usuário existe
    const [[usuario]] = await db.query(
      'SELECT id FROM usuarios WHERE id = ?',
      [usuarioId]
    );

    if (!usuario) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    // Verificar se já existe este responsável para esta obrigação
    const [[existente]] = await db.query(
      'SELECT usuarioId FROM obrigacoes_responsaveis_cliente WHERE obrigacaoId = ? AND usuarioId = ? AND clienteId IS NULL',
      [obrigacaoId, usuarioId]
    );

    if (existente) {
      return res.status(400).json({ error: 'Este usuário já é responsável fixo global desta obrigação' });
    }

    // Adicionar responsável fixo global (clienteId = null)
    await db.query(
      'INSERT INTO obrigacoes_responsaveis_cliente (obrigacaoId, clienteId, usuarioId) VALUES (?, NULL, ?)',
      [obrigacaoId, usuarioId]
    );

    res.status(201).json({ 
      success: true, 
      message: 'Responsável fixo global adicionado com sucesso' 
    });
  } catch (error) {
    console.error('Erro ao adicionar responsável fixo global:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * DELETE remover responsável fixo global
 * Exemplo: DELETE /api/obrigacoes/:obrigacaoId/responsaveis-fixos-globais/:usuarioId
 */
router.delete('/:obrigacaoId/responsaveis-fixos-globais/:usuarioId', verifyToken, async (req, res) => {
  const { obrigacaoId, usuarioId } = req.params;

  try {
    // Verificar se a obrigação existe
    const [[obrigacao]] = await db.query(
      'SELECT id FROM obrigacoes WHERE id = ?',
      [obrigacaoId]
    );

    if (!obrigacao) {
      return res.status(404).json({ error: 'Obrigação não encontrada' });
    }

    // Verificar se o responsável existe
    const [[responsavel]] = await db.query(
      'SELECT usuarioId FROM obrigacoes_responsaveis_cliente WHERE obrigacaoId = ? AND usuarioId = ? AND clienteId IS NULL',
      [obrigacaoId, usuarioId]
    );

    if (!responsavel) {
      return res.status(404).json({ error: 'Responsável fixo global não encontrado' });
    }

    // Remover responsável fixo global
    await db.query(
      'DELETE FROM obrigacoes_responsaveis_cliente WHERE obrigacaoId = ? AND usuarioId = ? AND clienteId IS NULL',
      [obrigacaoId, usuarioId]
    );

    res.json({ 
      success: true, 
      message: 'Responsável fixo global removido com sucesso' 
    });
  } catch (error) {
    console.error('Erro ao remover responsável fixo global:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * GET buscar todos os responsáveis de uma obrigação (individuais e globais)
 * Exemplo: GET /api/obrigacoes/:obrigacaoId/responsaveis-todos
 */
router.get('/:obrigacaoId/responsaveis-todos', verifyToken, async (req, res) => {
  const { obrigacaoId } = req.params;

  try {
    // Verificar se a obrigação existe
    const [[obrigacao]] = await db.query(
      'SELECT id FROM obrigacoes WHERE id = ?',
      [obrigacaoId]
    );

    if (!obrigacao) {
      return res.status(404).json({ error: 'Obrigação não encontrada' });
    }

    // Buscar todos os responsáveis individuais e globais de uma vez
    const [responsaveis] = await db.query(`
      SELECT DISTINCT
        orc.usuarioId,
        orc.clienteId,
        u.nome,
        u.email,
        d.nome as departamentoNome,
        CASE 
          WHEN orc.clienteId IS NULL THEN 'global'
          ELSE 'individual'
        END as tipo
      FROM obrigacoes_responsaveis_cliente orc
      JOIN usuarios u ON u.id = orc.usuarioId
      LEFT JOIN relacao_empresas re ON re.usuarioId = u.id
      LEFT JOIN departamentos d ON d.id = re.departamentoId
      WHERE orc.obrigacaoId = ?
      ORDER BY orc.clienteId ASC, u.nome ASC
    `, [obrigacaoId]);

    // Organizar por cliente
    const responsaveisPorCliente = {};
    const responsaveisGlobais = [];

    responsaveis.forEach(resp => {
      if (resp.clienteId === null) {
        // Responsável global
        responsaveisGlobais.push({
          id: resp.usuarioId,
          usuarioId: resp.usuarioId,
          nome: resp.nome,
          email: resp.email,
          departamentoNome: resp.departamentoNome,
          tipo: 'global',
          clienteId: null
        });
      } else {
        // Responsável individual
        if (!responsaveisPorCliente[resp.clienteId]) {
          responsaveisPorCliente[resp.clienteId] = [];
        }
        responsaveisPorCliente[resp.clienteId].push({
          id: resp.usuarioId,
          usuarioId: resp.usuarioId,
          nome: resp.nome,
          email: resp.email,
          departamentoNome: resp.departamentoNome,
          tipo: 'individual',
          clienteId: resp.clienteId
        });
      }
    });

    res.json({
      globais: responsaveisGlobais,
      porCliente: responsaveisPorCliente
    });
  } catch (err) {
    console.error('Erro ao buscar responsáveis:', err);
    res.status(500).json({ error: 'Erro ao buscar responsáveis.' });
  }
});

// 📌 Gerar tarefas individualmente por cliente
router.post("/gerar-tarefas", verifyToken, async (req, res) => {
  const { clienteId, obrigacaoIds, ano, vencimentoAPartir, mesReferenciaAte } = req.body;

  console.log("🔍 Dados recebidos:", { clienteId, obrigacaoIds, ano, vencimentoAPartir, mesReferenciaAte });

  if (!clienteId || !obrigacaoIds || !ano || !vencimentoAPartir || !mesReferenciaAte) {
    console.log("❌ Validação falhou:", { clienteId, obrigacaoIds, ano, vencimentoAPartir, mesReferenciaAte });
    return res.status(400).json({ erro: 'Todos os campos são obrigatórios' });
  }

  // Validar se obrigacaoIds é um array e não está vazio
  if (!Array.isArray(obrigacaoIds) || obrigacaoIds.length === 0) {
    console.log("❌ obrigacaoIds inválido:", obrigacaoIds);
    return res.status(400).json({ erro: 'obrigacaoIds deve ser um array não vazio' });
  }

  // Função para inserir as atividades base em batch
  async function clonarAtividadesBase(clienteId, obrigacaoClienteId, atividadesBase) {
    if (atividadesBase.length === 0) return;
    
    // Verificar se já existem atividades para esta obrigação do cliente
    const [atividadesExistentes] = await db.query(`
      SELECT id FROM obrigacoes_atividades_clientes 
      WHERE cliente_id = ? AND obrigacao_cliente_id = ?
    `, [clienteId, obrigacaoClienteId]);
    
    // Se já existem atividades, não inserir novamente
    if (atividadesExistentes.length > 0) {
      console.log(`⚠️ Atividades já existem para cliente ${clienteId}, obrigação ${obrigacaoClienteId}. Pulando inserção.`);
      return;
    }
    
    const values = atividadesBase.map(atv => [
      clienteId,
      obrigacaoClienteId,
      atv.tipo,
      atv.texto,
      atv.descricao,
      atv.tipoCancelamento,
      atv.ordem,
    ]);
    const placeholders = values.map(() => "(?, ?, ?, ?, ?, ?, ?)").join(", ");
    const flatValues = values.flat();
    await db.query(`
      INSERT INTO obrigacoes_atividades_clientes
      (cliente_id, obrigacao_cliente_id, tipo, texto, descricao, tipo_cancelamento, ordem)
      VALUES ${placeholders}
    `, flatValues);
    
    console.log(`✅ Inseridas ${atividadesBase.length} atividades para cliente ${clienteId}, obrigação ${obrigacaoClienteId}`);
  }

  function calcularAnoReferencia(anoAtual, fatoGerador) {
    switch (fatoGerador) {
      case "6 anos anteriores": return anoAtual - 6;
      case "5 anos anteriores": return anoAtual - 5;
      case "4 anos anteriores": return anoAtual - 4;
      case "3 anos anteriores": return anoAtual - 3;
      case "2 anos anteriores": return anoAtual - 2;
      case "Ano anterior": return anoAtual - 1;
      case "Próximo ano": return anoAtual + 1;
      case "Mesmo ano":
      default: return anoAtual;
    }
  }

  function calcularMesReferencia(mesVencimento, fatoGerador) {
    switch (fatoGerador) {
      case "Mês anterior":
        const mesAnterior = mesVencimento - 1;
        return mesAnterior < 1 ? 12 : mesAnterior;
      case "Próximo mês":
        const proximoMes = mesVencimento + 1;
        return proximoMes > 12 ? 1 : proximoMes;
      case "Mesmo mês":
      default:
        return mesVencimento;
    }
  }

  const MAX_PARALLEL = 10;
  async function processarLote(lote, atividadesBase, obrigacao, responsaveisIndividuaisMap, responsavelGlobalId, contadores) {
    await Promise.all(lote.map(async ({ clienteId, anoCalc, mesReferencia, vencimento, nomeObrigacao, acao, meta }) => {
      try {
        // ✅ NOVO: Verificar se já existe tarefa para este cliente, obrigação, ano e mês
        const [existentes] = await db.query(`
          SELECT id FROM obrigacoes_clientes
          WHERE cliente_id = ? AND obrigacao_id = ? AND ano_referencia = ? AND mes_referencia = ?
        `, [clienteId, obrigacao.id, anoCalc, mesReferencia]);
        
        if (existentes.length > 0) {
          console.log(`⚠️ Tarefa já existe para cliente ${clienteId}, obrigação ${obrigacao.id}, ano ${anoCalc}, mês ${mesReferencia}. Pulando inserção.`);
          contadores.puladas++;
          return;
        }

        // Buscar responsável individual
        const responsavelId = responsaveisIndividuaisMap.get(obrigacao.id) || responsavelGlobalId || null;

        const [res] = await db.query(`
          INSERT INTO obrigacoes_clientes
          (clienteId, obrigacaoId, nome, descricao, status, ano_referencia, mes_referencia, vencimento, dataCriacao, responsavelId, acao, meta)
          VALUES (?, ?, ?, ?, 'pendente', ?, ?, ?, NOW(), ?, ?, ?)
        `, [
          clienteId,
          obrigacao.id,
          obrigacao.nome,
          `Obrigação ${obrigacao.nome} de ${String(mesReferencia).padStart(2, "0")}/${anoCalc}`,
          anoCalc,
          mesReferencia,
          vencimento,
          responsavelId,
          acao,
          meta,
        ]);
        
        console.log("✅ Tarefa gerada! obrigacaoClienteId:", res.insertId, "| clienteId:", clienteId, "| responsavelId:", responsavelId);
        contadores.geradas++;
        
        // Popular obrigacoes_clientes_responsaveis
        console.log(`🔍 Inserindo múltiplos responsáveis para obrigacaoClienteId: ${res.insertId}, obrigacaoId: ${obrigacao.id}, clienteId: ${clienteId}`);
        
        // Buscar responsáveis individuais do cliente
        const [multiResponsaveisIndividuais] = await db.query(`
          SELECT usuario_id FROM obrigacoes_responsaveis_cliente WHERE obrigacao_id = ? AND cliente_id = ?
        `, [obrigacao.id, clienteId]);
        
        // Buscar responsáveis globais (clienteId = null)
        const [multiResponsaveisGlobais] = await db.query(`
          SELECT usuario_id FROM obrigacoes_responsaveis_cliente WHERE obrigacao_id = ? AND cliente_id IS NULL
        `, [obrigacao.id]);
        
        console.log(`🔍 Responsáveis individuais encontrados:`, multiResponsaveisIndividuais);
        console.log(`🔍 Responsáveis globais encontrados:`, multiResponsaveisGlobais);
        
        // Se há responsáveis individuais, usar apenas eles
        // Se não há individuais, usar os globais
        const responsaveisParaInserir = multiResponsaveisIndividuais.length > 0 
          ? multiResponsaveisIndividuais 
          : multiResponsaveisGlobais;
        
        if (responsaveisParaInserir.length > 0) {
          console.log(`🔍 Inserindo ${responsaveisParaInserir.length} responsáveis`);
          for (const resp of responsaveisParaInserir) {
            console.log(`🔍 Inserindo responsável: ${resp.usuarioId}`);
            await db.query(`
              INSERT IGNORE INTO obrigacoes_clientes_responsaveis (obrigacaoClienteId, usuarioId)
              VALUES (?, ?)
            `, [res.insertId, resp.usuarioId]);
          }
        } else {
          console.log(`🔍 Nenhum responsável encontrado para inserir`);
        }
        await clonarAtividadesBase(clienteId, res.insertId, atividadesBase);
      } catch (err) {
        if (!err.message.includes("Duplicate")) console.error("Erro ao inserir tarefa:", err);
      }
    }));
  }

  try {
    // Converter vencimentoAPartir e mesReferenciaAte para números de mês
    const mesesMap = {
      "Janeiro": 1, "Fevereiro": 2, "Março": 3, "Abril": 4, "Maio": 5, "Junho": 6,
      "Julho": 7, "Agosto": 8, "Setembro": 9, "Outubro": 10, "Novembro": 11, "Dezembro": 12
    };
    
    const mesInicio = mesesMap[vencimentoAPartir];
    const mesFim = mesesMap[mesReferenciaAte];
    
    console.log("🔍 Mapeamento de meses:", { vencimentoAPartir, mesInicio, mesReferenciaAte, mesFim });
    
    if (!mesInicio || !mesFim) {
      console.log("❌ Meses inválidos:", { vencimentoAPartir, mesInicio, mesReferenciaAte, mesFim });
      return res.status(400).json({ erro: 'Meses inválidos' });
    }

    console.log(`🚀 Iniciando processamento de ${obrigacaoIds.length} obrigações para cliente ${clienteId}`);
    
    let tarefasGeradas = 0;
    let tarefasPuladas = 0;
    
    // ✅ NOVO: Buscar responsáveis ANTES de processar as obrigações (mesmo padrão da gerar-atividades)
    const responsaveisIndividuaisMap = new Map();
    const responsaveisGlobaisMap = new Map();
    
    // Buscar responsáveis individuais para o cliente
    if (obrigacaoIds.length > 0) {
      const [responsaveisIndividuais] = await db.query(`
        SELECT rc.clienteId, rc.usuarioId, rc.obrigacaoId
        FROM obrigacoes_responsaveis_cliente rc
        WHERE rc.obrigacaoId IN (?) AND rc.clienteId = ?
      `, [obrigacaoIds, clienteId]);
      
      for (const r of responsaveisIndividuais) {
        responsaveisIndividuaisMap.set(r.obrigacaoId, r.usuarioId);
      }
      
      // Buscar responsáveis globais (clienteId = null) para cada obrigação
      for (const obrigacaoId of obrigacaoIds) {
        const [[globalResp]] = await db.query(`
          SELECT usuario_id FROM obrigacoes_responsaveis_cliente WHERE obrigacao_id = ? AND cliente_id IS NULL
        `, [obrigacaoId]);
        if (globalResp) {
          responsaveisGlobaisMap.set(obrigacaoId, globalResp.usuarioId);
        }
      }
    }
    
    console.log("🔍 Responsáveis encontrados:", { 
      individuais: Array.from(responsaveisIndividuaisMap.entries()),
      globais: Array.from(responsaveisGlobaisMap.entries())
    });
    
    // Processar cada obrigação selecionada
    for (const obrigacaoId of obrigacaoIds) {
      const [obrigacoes] = await db.query(`SELECT * FROM obrigacoes WHERE id = ?`, [obrigacaoId]);
      const obrigacao = obrigacoes[0];
      if (!obrigacao) {
        console.log(`⚠️ Obrigação ${obrigacaoId} não encontrada`);
        continue;
      }

      const [atividadesBase] = await db.query(`SELECT * FROM atividades_obrigacao WHERE obrigacaoId = ?`, [obrigacaoId]);

      // Verificar se o cliente atende às particularidades da obrigação
      const [particularidadesE] = await db.query(`
        SELECT particularidadeId FROM obrigacoes_particularidades WHERE obrigacaoId = ? AND tipo = 'E'
      `, [obrigacaoId]);
      const [particularidadesOU] = await db.query(`
        SELECT particularidadeId FROM obrigacoes_particularidades WHERE obrigacaoId = ? AND tipo = 'OU'
      `, [obrigacaoId]);
      const [particularidadesEXCETO] = await db.query(`
        SELECT particularidadeId FROM obrigacoes_particularidades WHERE obrigacaoId = ? AND tipo = 'EXCETO'
      `, [obrigacaoId]);
      
      const partE = particularidadesE.map(p => p.particularidadeId);
      const partOU = particularidadesOU.map(p => p.particularidadeId);
      const partEXCETO = particularidadesEXCETO.map(p => p.particularidadeId);

      // Buscar respostas do cliente
      const [respostasCliente] = await db.query(`
        SELECT cr.clienteId, er.particularidadeId
        FROM cliente_respostas cr
        JOIN enquete_respostas er ON cr.respostaId = er.id
        WHERE cr.clienteId = ?
      `, [clienteId]);

      const clienteParticularidades = new Set(respostasCliente.map(r => r.particularidadeId));
      
      // Verificar se o cliente atende às particularidades
      const atendeTodasE = partE.every(pid => clienteParticularidades.has(pid));
      const atendeAlgumaOU = partOU.length === 0 || partOU.some(pid => clienteParticularidades.has(pid));
      const temAlgumExceto = partEXCETO.length > 0 && partEXCETO.some(pid => clienteParticularidades.has(pid));
      
      if (!atendeTodasE || !atendeAlgumaOU || temAlgumExceto) {
        console.log(`⚠️ Cliente ${clienteId} não atende às particularidades da obrigação ${obrigacaoId}`);
        continue;
      }

      // Frequências
      let meses = [];
      switch (obrigacao.frequencia) {
        case "Mensal":        for (let i = mesInicio; i <= mesFim; i++) meses.push(i); break;
        case "Bimestral":     for (let i = mesInicio; i <= mesFim; i += 2) meses.push(i); break;
        case "Trimestral":
        case "Trimestral 2 Cotas":
        case "Trimestral 3 Cotas": for (let i = mesInicio; i <= mesFim; i += 3) meses.push(i); break;
        case "Quadrimestral": for (let i = mesInicio; i <= mesFim; i += 4) meses.push(i); break;
        case "Semestral":     for (let i = mesInicio; i <= mesFim; i += 6) meses.push(i); break;
        case "Anual":
          // 🎯 CORREÇÃO: Obrigações anuais devem usar o campo diaSemana como mês
          const mesAnual2 = obterMesDoDiaSemana(obrigacao.diaSemana);
          if (mesAnual2) {
            // Lógica inteligente: verificar se o mês ainda cabe no ano atual
            const mesAtual2 = new Date().getMonth() + 1; // Mês atual (1-12)
            
            if (mesAnual2 >= mesInicio && mesAnual2 <= mesFim) {
              // Mês está dentro do período selecionado
              meses = [mesAnual2];
              console.log(`📌 Obrigação anual configurada para mês: ${mesAnual2} (${obrigacao.diaSemana}) - dentro do período`);
            } else if (mesAnual2 < mesAtual2 && mesInicio <= 12) {
              // Mês já passou no ano atual, mas usuário pode querer gerar para o próximo ano
              const mesProximoAno2 = mesAnual2;
              if (mesProximoAno2 >= 1 && mesProximoAno2 <= 12) {
                meses = [mesProximoAno2];
                console.log(`📌 Obrigação anual configurada para mês: ${mesProximoAno2} (${obrigacao.diaSemana}) - próximo ano`);
              } else {
                meses = [];
                console.log(`⚠️ Mês anual ${mesAnual2} (${obrigacao.diaSemana}) não pode ser processado`);
              }
            } else {
              meses = [];
              console.log(`⚠️ Mês anual ${mesAnual2} (${obrigacao.diaSemana}) fora do período ${mesInicio}-${mesFim}`);
            }
          } else {
            console.log(`⚠️ Mês anual inválido: ${obrigacao.diaSemana}`);
            meses = [];
          }
          break;
        case "Esporadica":    meses = [mesInicio]; break;
        case "Diário":
          const hoje = new Date();
          hoje.setHours(0, 0, 0, 0);
          // Buscar todas as obrigações já existentes para o período, cliente e obrigação
          const [existentesDiario] = await db.query(`
            SELECT clienteId, obrigacaoId, ano_referencia, mes_referencia, vencimento
            FROM obrigacoes_clientes
            WHERE obrigacao_id = ? AND ano_referencia = ? AND mes_referencia BETWEEN ? AND ? AND clienteId = ?
          `, [obrigacaoId, ano, mesInicio, mesFim, clienteId]);
          const existeSetDiario = new Set(existentesDiario.map(e => `${e.clienteId}|${e.obrigacaoId}|${e.ano_referencia}|${e.mes_referencia}|${e.vencimento.toISOString().slice(0,10)}`));
          const novasDiario = [];
          for (let mes = mesInicio; mes <= mesFim; mes++) {
            const diasNoMes = new Date(ano, mes, 0).getDate();
            for (let dia = 1; dia <= diasNoMes; dia++) {
              const data = new Date(ano, mes - 1, dia);
              data.setHours(0, 0, 0, 0);
              if (data < hoje) continue;
              const weekday = data.getDay();
              if (weekday === 0 || weekday === 6) continue;
              const chave = `${clienteId}|${obrigacaoId}|${ano}|${mes}|${data.toISOString().slice(0,10)}`;
              if (existeSetDiario.has(chave)) continue;
              // Calcular acao/meta
              const vencimento = data.toISOString().split("T")[0];
              const meta = obrigacao.metaQtdDias != null && obrigacao.metaTipoDias ? subtrairDias(vencimento, obrigacao.metaQtdDias, obrigacao.metaTipoDias).toISOString().split("T")[0] : null;
              const acao = obrigacao.acaoQtdDias != null && obrigacao.acaoTipoDias ? subtrairDias(meta, obrigacao.acaoQtdDias, obrigacao.acaoTipoDias).toISOString().split("T")[0] : null;
              const responsavelId = responsaveisIndividuaisMap.get(obrigacaoId) || responsaveisGlobaisMap.get(obrigacaoId) || null;
              novasDiario.push([
                clienteId,
                obrigacaoId,
                obrigacao.nome,
                `Obrigacao ${obrigacao.nome} de ${String(mes).padStart(2, "0")}/${ano}`,
                'pendente',
                ano,
                mes,
                vencimento,
                responsavelId,
                acao,
                meta
              ]);
            }
          }
          if (novasDiario.length) {
            const placeholders = novasDiario.map(() => "(?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?)").join(",");
            const flat = novasDiario.flat();
            const [result] = await db.query(`
              INSERT INTO obrigacoes_clientes
              (clienteId, obrigacaoId, nome, descricao, status, ano_referencia, mes_referencia, vencimento, dataCriacao, responsavelId, acao, meta)
              VALUES ${placeholders}
            `, flat);
            // Buscar os IDs inseridos
            const insertedIds = [];
            const [ultimos] = await db.query('SELECT id, clienteId FROM obrigacoes_clientes WHERE obrigacaoId = ? AND ano_referencia = ? AND mes_referencia BETWEEN ? AND ? AND clienteId = ?', [obrigacaoId, ano, mesInicio, mesFim, clienteId]);
            for (const row of ultimos) insertedIds.push({ id: row.id, clienteId: row.clienteId });
            
            // Popular obrigacoes_clientes_responsaveis para inserções em lote (Diário)
            console.log(`🔍 Processando ${insertedIds.length} tarefas inseridas em lote (Diário)`);
            for (const { id: obrigacaoClienteId, clienteId } of insertedIds) {
              console.log(`🔍 Inserindo múltiplos responsáveis para obrigacaoClienteId: ${obrigacaoClienteId}, clienteId: ${clienteId}`);
              
              // Buscar responsáveis individuais do cliente
              const [multiResponsaveisIndividuais] = await db.query(`
                SELECT usuario_id FROM obrigacoes_responsaveis_cliente WHERE obrigacao_id = ? AND cliente_id = ?
              `, [obrigacaoId, clienteId]);
              
              // Buscar responsáveis globais (clienteId = null)
              const [multiResponsaveisGlobais] = await db.query(`
                SELECT usuario_id FROM obrigacoes_responsaveis_cliente WHERE obrigacao_id = ? AND cliente_id IS NULL
              `, [obrigacaoId]);
              
              console.log(`🔍 Responsáveis individuais encontrados para cliente ${clienteId}:`, multiResponsaveisIndividuais);
              console.log(`🔍 Responsáveis globais encontrados:`, multiResponsaveisGlobais);
              
              // Se há responsáveis individuais, usar apenas eles
              // Se não há individuais, usar os globais
              const responsaveisParaInserir = multiResponsaveisIndividuais.length > 0 
                ? multiResponsaveisIndividuais 
                : multiResponsaveisGlobais;
              
              if (responsaveisParaInserir.length > 0) {
                console.log(`🔍 Inserindo ${responsaveisParaInserir.length} responsáveis`);
                for (const resp of responsaveisParaInserir) {
                  console.log(`🔍 Inserindo responsável: ${resp.usuarioId}`);
                  await db.query(`
                    INSERT INTO obrigacoes_clientes_responsaveis (obrigacaoClienteId, usuarioId)
                    VALUES (?, ?)
                  `, [obrigacaoClienteId, resp.usuarioId]);
                }
              } else {
                console.log(`🔍 Nenhum responsável encontrado para inserir`);
              }
            }
            
            // Clonar atividades base para cada nova obrigação
            for (const { id, clienteId } of insertedIds) {
              await clonarAtividadesBase(clienteId, id, atividadesBase);
            }
          }
          continue;
        case "Semanal":
          const hojeSemanal = new Date();
          hojeSemanal.setHours(0, 0, 0, 0);
          const diaSemanaMap = {
            Domingo: 0, Segunda: 1, Terca: 2, Terça: 2, Quarta: 3, Quinta: 4, Sexta: 5, Sabado: 6,
          };
          const diaAlvo = diaSemanaMap[obrigacao.diaSemana];
          if (diaAlvo === undefined) {
            console.log(`⚠️ Dia da semana inválido para obrigação ${obrigacaoId}`);
            continue;
          }
          // Buscar todas as obrigações já existentes para o período, cliente e obrigação
          const [existentesSemanal] = await db.query(`
            SELECT clienteId, obrigacaoId, ano_referencia, mes_referencia, vencimento
            FROM obrigacoes_clientes
            WHERE obrigacao_id = ? AND ano_referencia = ? AND mes_referencia BETWEEN ? AND ? AND clienteId = ?
          `, [obrigacaoId, ano, mesInicio, mesFim, clienteId]);
          const existeSetSemanal = new Set(existentesSemanal.map(e => `${e.clienteId}|${e.obrigacaoId}|${e.ano_referencia}|${e.mes_referencia}|${e.vencimento.toISOString().slice(0,10)}`));
          const novasSemanal = [];
          for (let mes = mesInicio; mes <= mesFim; mes++) {
            const diasNoMes = new Date(ano, mes, 0).getDate();
            for (let dia = 1; dia <= diasNoMes; dia++) {
              const data = new Date(ano, mes - 1, dia);
              data.setHours(0, 0, 0, 0);
              if (data < hojeSemanal) continue;
              if (data.getDay() !== diaAlvo) continue;
              const chave = `${clienteId}|${obrigacaoId}|${ano}|${mes}|${data.toISOString().slice(0,10)}`;
              if (existeSetSemanal.has(chave)) continue;
              // Calcular acao/meta
              const vencimento = data.toISOString().split("T")[0];
              const meta = obrigacao.metaQtdDias != null && obrigacao.metaTipoDias ? subtrairDias(vencimento, obrigacao.metaQtdDias, obrigacao.metaTipoDias).toISOString().split("T")[0] : null;
              const acao = obrigacao.acaoQtdDias != null && obrigacao.acaoTipoDias ? subtrairDias(meta, obrigacao.acaoQtdDias, obrigacao.acaoTipoDias).toISOString().split("T")[0] : null;
              const responsavelId = responsaveisIndividuaisMap.get(obrigacaoId) || responsaveisGlobaisMap.get(obrigacaoId) || null;
              novasSemanal.push([
                clienteId,
                obrigacaoId,
                obrigacao.nome,
                `Obrigacao ${obrigacao.nome} de ${String(mes).padStart(2, "0")}/${ano}`,
                'pendente',
                ano,
                mes,
                vencimento,
                responsavelId,
                acao,
                meta
              ]);
            }
          }
          if (novasSemanal.length) {
            const placeholders = novasSemanal.map(() => "(?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?)").join(",");
            const flat = novasSemanal.flat();
            const [result] = await db.query(`
              INSERT INTO obrigacoes_clientes
              (clienteId, obrigacaoId, nome, descricao, status, ano_referencia, mes_referencia, vencimento, dataCriacao, responsavelId, acao, meta)
              VALUES ${placeholders}
            `, flat);
            // Buscar os IDs inseridos
            const insertedIds = [];
            const [ultimos] = await db.query('SELECT id, clienteId FROM obrigacoes_clientes WHERE obrigacaoId = ? AND ano_referencia = ? AND mes_referencia BETWEEN ? AND ? AND clienteId = ?', [obrigacaoId, ano, mesInicio, mesFim, clienteId]);
            for (const row of ultimos) insertedIds.push({ id: row.id, clienteId: row.clienteId });
            
            // Popular obrigacoes_clientes_responsaveis para inserções em lote (Semanal)
            console.log(`🔍 Processando ${insertedIds.length} tarefas inseridas em lote (Semanal)`);
            for (const { id: obrigacaoClienteId, clienteId } of insertedIds) {
              console.log(`🔍 Inserindo múltiplos responsáveis para obrigacaoClienteId: ${obrigacaoClienteId}, clienteId: ${clienteId}`);
              
              // Buscar responsáveis individuais do cliente
              const [multiResponsaveisIndividuais] = await db.query(`
                SELECT usuario_id FROM obrigacoes_responsaveis_cliente WHERE obrigacao_id = ? AND cliente_id = ?
              `, [obrigacaoId, clienteId]);
              
              // Buscar responsáveis globais (clienteId = null)
              const [multiResponsaveisGlobais] = await db.query(`
                SELECT usuario_id FROM obrigacoes_responsaveis_cliente WHERE obrigacao_id = ? AND cliente_id IS NULL
              `, [obrigacaoId]);
              
              console.log(`🔍 Responsáveis individuais encontrados para cliente ${clienteId}:`, multiResponsaveisIndividuais);
              console.log(`🔍 Responsáveis globais encontrados:`, multiResponsaveisGlobais);
              
              // Se há responsáveis individuais, usar apenas eles
              // Se não há individuais, usar os globais
              const responsaveisParaInserir = multiResponsaveisIndividuais.length > 0 
                ? multiResponsaveisIndividuais 
                : multiResponsaveisGlobais;
              
              if (responsaveisParaInserir.length > 0) {
                console.log(`🔍 Inserindo ${responsaveisParaInserir.length} responsáveis`);
                for (const resp of responsaveisParaInserir) {
                  console.log(`🔍 Inserindo responsável: ${resp.usuarioId}`);
                  await db.query(`
                    INSERT INTO obrigacoes_clientes_responsaveis (obrigacaoClienteId, usuarioId)
                    VALUES (?, ?)
                  `, [obrigacaoClienteId, resp.usuarioId]);
                }
              } else {
                console.log(`🔍 Nenhum responsável encontrado para inserir`);
              }
            }
            
            // Clonar atividades base para cada nova obrigação
            for (const { id, clienteId } of insertedIds) {
              await clonarAtividadesBase(clienteId, id, atividadesBase);
            }
          }
          continue;
        default: 
          console.log(`⚠️ Frequência inválida ou não suportada para obrigação ${obrigacaoId}: ${obrigacao.frequencia}`);
          continue;
      }

      // Lógica de fato gerador - define o ano e mês de referência baseado no fato gerador
      const anoReferencia = calcularAnoReferencia(ano, obrigacao.fatoGerador);
      const tarefasParaCriar = [];
      
      for (const mesVencimento of meses) {
        // Calcular mês de referência baseado no fato gerador
        let mesCompetencia = calcularMesReferencia(mesVencimento, obrigacao.fatoGerador);
        let anoCompetencia = anoReferencia;

        // Ajustar ano se necessário quando o mês muda
        if (obrigacao.fatoGerador === 'Mês anterior' && mesCompetencia === 12 && mesVencimento === 1) {
          anoCompetencia = anoReferencia - 1;
        } else if (obrigacao.fatoGerador === 'Próximo mês' && mesCompetencia === 1 && mesVencimento === 12) {
          anoCompetencia = anoReferencia + 1;
        }
        
        const vencimento = calcularVencimento(
          ano, // ano de vencimento sempre é o ano atual
          mesVencimento,
          obrigacao.vencimentoTipo,
          obrigacao.vencimentoDia,
          obrigacao.fatoGerador
        );
        
        // Calcular acao/meta
        const meta = obrigacao.metaQtdDias != null && obrigacao.metaTipoDias ? subtrairDias(vencimento, obrigacao.metaQtdDias, obrigacao.metaTipoDias).toISOString().split("T")[0] : null;
        const acao = obrigacao.acaoQtdDias != null && obrigacao.acaoTipoDias ? subtrairDias(meta, obrigacao.acaoQtdDias, obrigacao.acaoTipoDias).toISOString().split("T")[0] : null;
        
        tarefasParaCriar.push({
          clienteId,
          anoCalc: anoCompetencia, // ano de referência baseado no fato gerador
          mesReferencia: mesCompetencia,
          vencimento,
          nomeObrigacao: `${obrigacao.nome} de ${String(mesCompetencia).padStart(2, "0")}/${anoCompetencia}`,
          acao,
          meta,
        });
      }
      
      for (let i = 0; i < tarefasParaCriar.length; i += MAX_PARALLEL) {
        const lote = tarefasParaCriar.slice(i, i + MAX_PARALLEL);
        await processarLote(lote, atividadesBase, obrigacao, responsaveisIndividuaisMap, responsaveisGlobaisMap.get(obrigacao.id), { geradas: tarefasGeradas, puladas: tarefasPuladas });
      }
    }

    console.log(`📊 Resumo: ${tarefasGeradas} tarefas geradas, ${tarefasPuladas} tarefas puladas (já existiam)`);
    res.status(200).json({ 
      ok: true, 
      mensagem: "Tarefas geradas com sucesso!", 
      resumo: {
        tarefasGeradas,
        tarefasPuladas
      }
    });
  } catch (err) {
    console.error("Erro ao gerar tarefas:", err);
    res.status(500).json({ erro: 'Erro ao gerar tarefas' });
  }
});

// ================= ATUALIZAR TAREFAS DOS CLIENTES =================

/**
 * GET verificar se há tarefas que podem ser atualizadas
 * Exemplo: GET /api/obrigacoes/:obrigacaoId/verificar-atualizacao-tarefas
 */
router.get('/:obrigacaoId/verificar-atualizacao-tarefas', verifyToken, async (req, res) => {
  const { obrigacaoId } = req.params;

  try {
    // Verificar se a obrigação existe
    const [[obrigacao]] = await db.query(
      'SELECT id, nome FROM obrigacoes WHERE id = ?',
      [obrigacaoId]
    );

    if (!obrigacao) {
      return res.status(404).json({ error: 'Obrigação não encontrada' });
    }

    // Buscar atividades base atuais da obrigação
    const [atividadesBase] = await db.query(`
      SELECT id, tipo, texto, descricao, tipoCancelamento, ordem, pdf_layout_id, titulo_documento
      FROM atividades_obrigacao 
      WHERE obrigacao_id = ? 
      ORDER BY ordem
    `, [obrigacaoId]);

    if (atividadesBase.length === 0) {
      return res.json({
        podeAtualizar: false,
        motivo: 'Não há atividades base configuradas para esta obrigação'
      });
    }

    // Buscar obrigações dos clientes onde TODAS as atividades estão intocadas
    // Se qualquer atividade foi mexida, a obrigação inteira é ignorada
    const [obrigacoesIntocadas] = await db.query(`
      SELECT oc.id as obrigacaoClienteId, oc.clienteId, c.nome as clienteNome,
             COUNT(oac.id) as totalAtividades,
             COUNT(CASE WHEN 
               oac.concluida = 0 
               AND oac.cancelada = 0
               AND oac.dataConclusao IS NULL
               AND oac.dataCancelamento IS NULL
               AND (oac.justificativa IS NULL OR oac.justificativa = '')
               AND (oac.anexo IS NULL OR oac.anexo = '')
               AND oac.concluidoPor IS NULL
             THEN 1 END) as atividadesIntocadas
      FROM obrigacoes_clientes oc
      JOIN obrigacoes_atividades_clientes oac ON oac.obrigacaoClienteId = oc.id
      JOIN clientes c ON oac.clienteId = c.id
      WHERE oc.obrigacaoId = ?
      GROUP BY oc.id, oc.clienteId, c.nome
      HAVING totalAtividades = atividadesIntocadas AND totalAtividades > 0
    `, [obrigacaoId]);

    const tarefasAtualizaveis = obrigacoesIntocadas;

    // Contar obrigações dos clientes que têm pelo menos uma atividade modificada (serão ignoradas)
    let obrigacoesIgnoradas = { total: 0 };
    if (tarefasAtualizaveis.length > 0) {
      const [[result]] = await db.query(`
        SELECT COUNT(DISTINCT oc.id) as total
        FROM obrigacoes_clientes oc
        JOIN obrigacoes_atividades_clientes oac ON oac.obrigacaoClienteId = oc.id
        WHERE oc.obrigacaoId = ?
          AND oc.id NOT IN (${tarefasAtualizaveis.map(() => '?').join(',')})
      `, [obrigacaoId, ...tarefasAtualizaveis.map(t => t.obrigacaoClienteId)]);
      obrigacoesIgnoradas = result;
    } else {
      // Se não há tarefas atualizáveis, todas são ignoradas
      const [[result]] = await db.query(`
        SELECT COUNT(DISTINCT oc.id) as total
        FROM obrigacoes_clientes oc
        JOIN obrigacoes_atividades_clientes oac ON oac.obrigacaoClienteId = oc.id
        WHERE oc.obrigacaoId = ?
      `, [obrigacaoId]);
      obrigacoesIgnoradas = result;
    }

    const tarefasIgnoradas = obrigacoesIgnoradas.total;

    // Detectar mudanças nas atividades (comparação simples)
    const mudancas = [];
    
    // Para simplificar, vamos apenas indicar que há atividades para replicar
    mudancas.push({
      tipo: 'Atualização Disponível',
      descricao: `${atividadesBase.length} atividade(s) base serão replicadas para as tarefas não modificadas`
    });

    if (tarefasAtualizaveis.length === 0) {
      return res.json({
        podeAtualizar: false,
        motivo: 'Todas as tarefas já foram modificadas pelos usuários'
      });
    }

    res.json({
      podeAtualizar: true,
      resumo: {
        clientesAfetados: new Set(tarefasAtualizaveis.map(t => t.clienteId)).size,
        tarefasAtualizaveis: tarefasAtualizaveis.length * atividadesBase.length,
        tarefasIgnoradas: Math.max(0, tarefasIgnoradas)
      },
      mudancas,
      obrigacao: {
        id: obrigacao.id,
        nome: obrigacao.nome
      }
    });

  } catch (error) {
    console.error('Erro ao verificar atualizações de tarefas:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * POST executar atualização das tarefas dos clientes
 * Exemplo: POST /api/obrigacoes/:obrigacaoId/atualizar-tarefas
 */
router.post('/:obrigacaoId/atualizar-tarefas', verifyToken, async (req, res) => {
  const { obrigacaoId } = req.params;

  try {
    // Verificar se a obrigação existe
    const [[obrigacao]] = await db.query(
      'SELECT id, nome FROM obrigacoes WHERE id = ?',
      [obrigacaoId]
    );

    if (!obrigacao) {
      return res.status(404).json({ error: 'Obrigação não encontrada' });
    }

    // Buscar atividades base atuais
    const [atividadesBase] = await db.query(`
      SELECT id, tipo, texto, descricao, tipoCancelamento, ordem, pdf_layout_id, titulo_documento
      FROM atividades_obrigacao 
      WHERE obrigacao_id = ? 
      ORDER BY ordem
    `, [obrigacaoId]);

    if (atividadesBase.length === 0) {
      return res.status(400).json({ error: 'Não há atividades base para replicar' });
    }

    // Buscar apenas obrigações dos clientes onde TODAS as atividades estão intocadas
    // Se qualquer atividade foi mexida, a obrigação inteira é ignorada
    const [obrigacoesClientes] = await db.query(`
      SELECT oc.id as obrigacaoClienteId, oc.clienteId,
             COUNT(oac.id) as totalAtividades,
             COUNT(CASE WHEN 
               oac.concluida = 0 
               AND oac.cancelada = 0
               AND oac.dataConclusao IS NULL
               AND oac.dataCancelamento IS NULL
               AND (oac.justificativa IS NULL OR oac.justificativa = '')
               AND (oac.anexo IS NULL OR oac.anexo = '')
               AND oac.concluidoPor IS NULL
             THEN 1 END) as atividadesIntocadas
      FROM obrigacoes_clientes oc
      JOIN obrigacoes_atividades_clientes oac ON oac.obrigacaoClienteId = oc.id
      WHERE oc.obrigacaoId = ?
      GROUP BY oc.id, oc.clienteId
      HAVING totalAtividades = atividadesIntocadas AND totalAtividades > 0
    `, [obrigacaoId]);

    if (obrigacoesClientes.length === 0) {
      return res.json({
        success: true,
        mensagem: 'Nenhuma tarefa precisava ser atualizada. Todas já foram modificadas pelos usuários.',
        clientesAfetados: 0,
        tarefasAtualizadas: 0
      });
    }

    let totalTarefasAtualizadas = 0;
    const clientesAfetados = new Set();

    // Processar cada obrigação do cliente (já sabemos que TODAS as atividades estão intocadas)
    for (const obrigacaoCliente of obrigacoesClientes) {
      try {
        console.log(`🔄 Atualizando obrigação ${obrigacaoCliente.obrigacaoClienteId} do cliente ${obrigacaoCliente.clienteId}`);
        console.log(`   Total atividades: ${obrigacaoCliente.totalAtividades}, Intocadas: ${obrigacaoCliente.atividadesIntocadas}`);

        // 1. Remover TODAS as atividades desta obrigação (já sabemos que estão intocadas)
        const [result] = await db.query(`
          DELETE FROM obrigacoes_atividades_clientes 
          WHERE obrigacaoClienteId = ?
        `, [obrigacaoCliente.obrigacaoClienteId]);

        const tarefasRemovidas = result.affectedRows;
        console.log(`🗑️ Removidas ${tarefasRemovidas} atividades antigas`);

        // 2. Recriar as atividades baseadas na estrutura atual
        if (tarefasRemovidas > 0) {
          const values = atividadesBase.map(atv => [
            obrigacaoCliente.clienteId,
            obrigacaoCliente.obrigacaoClienteId,
            atv.tipo,
            atv.texto,
            atv.descricao,
            atv.tipoCancelamento,
            atv.ordem,
          ]);

          const placeholders = values.map(() => "(?, ?, ?, ?, ?, ?, ?)").join(", ");
          const flatValues = values.flat();

          await db.query(`
            INSERT INTO obrigacoes_atividades_clientes
            (clienteId, obrigacaoClienteId, tipo, texto, descricao, tipoCancelamento, ordem)
            VALUES ${placeholders}
          `, flatValues);

          totalTarefasAtualizadas += atividadesBase.length;
          clientesAfetados.add(obrigacaoCliente.clienteId);

          console.log(`✅ Inseridas ${atividadesBase.length} atividades atualizadas para cliente ${obrigacaoCliente.clienteId}, obrigação ${obrigacaoCliente.obrigacaoClienteId}`);
        }

      } catch (error) {
        console.error(`❌ Erro ao atualizar tarefas para obrigação cliente ${obrigacaoCliente.obrigacaoClienteId}:`, error);
        // Continuar com as outras obrigações mesmo se uma falhar
      }
    }

    res.json({
      success: true,
      mensagem: `Tarefas atualizadas com sucesso! ${totalTarefasAtualizadas} atividades foram atualizadas para ${clientesAfetados.size} cliente(s).`,
      clientesAfetados: clientesAfetados.size,
      tarefasAtualizadas: totalTarefasAtualizadas,
      obrigacao: {
        id: obrigacao.id,
        nome: obrigacao.nome
      }
    });

  } catch (error) {
    console.error('Erro ao atualizar tarefas dos clientes:', error);
    res.status(500).json({ error: 'Erro interno do servidor ao atualizar tarefas' });
  }
});

// Rota para prorrogar tarefas
router.post("/prorrogar-tarefas", verifyToken, async (req, res) => {
  try {
    const {
      empresaId,
      obrigacaoId,
      alterarAcao,
      alterarMeta,
      alterarVencimento,
      novaAcao,
      novaMeta,
      novoVencimento,
      motivo,
      idsSelecionados
    } = req.body;

    if (!empresaId || !obrigacaoId || !idsSelecionados || idsSelecionados.length === 0) {
      return res.status(400).json({ error: "Dados obrigatórios não fornecidos" });
    }

    if (!alterarAcao && !alterarMeta && !alterarVencimento) {
      return res.status(400).json({ error: "Pelo menos um campo deve ser alterado" });
    }

    if (!motivo || motivo.trim() === "") {
      return res.status(400).json({ error: "Motivo é obrigatório" });
    }

    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(401).json({ error: "Token não fornecido" });
    }

    // Decodificar token para obter usuário
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const usuarioId = decoded.id;

    // Iniciar transação
    const connection = await db.getConnection();
    await connection.beginTransaction();

    try {
      for (const obrigacaoClienteId of idsSelecionados) {
        // Atualizar campos na tabela obrigacoes_clientes
        let updateFields = [];
        let updateValues = [];

        if (alterarAcao && novaAcao) {
          updateFields.push("acao = ?");
          updateValues.push(novaAcao);
        }

        if (alterarMeta && novaMeta) {
          updateFields.push("meta = ?");
          updateValues.push(novaMeta);
        }

        if (alterarVencimento && novoVencimento) {
          updateFields.push("vencimento = ?");
          updateValues.push(novoVencimento);
        }

        if (updateFields.length > 0) {
          const updateQuery = `
            UPDATE obrigacoes_clientes 
            SET ${updateFields.join(", ")}
            WHERE id = ?
          `;
          
          await connection.execute(updateQuery, [...updateValues, obrigacaoClienteId]);
        }

        // Adicionar comentário na tabela comentarios_obrigacao
        const comentarioQuery = `
          INSERT INTO comentarios_obrigacao 
          (obrigacaoid, comentario, tipo, usuarioId, criadoEm)
          VALUES (?, ?, 'usuario', ?, NOW())
        `;
        
        await connection.execute(comentarioQuery, [
          obrigacaoClienteId,
          `Motivo de Prorrogação da Tarefa: ${motivo}`,
          usuarioId
        ]);
      }

      await connection.commit();
      connection.release();

      res.json({ 
        success: true, 
        message: `${idsSelecionados.length} tarefa(s) prorrogada(s) com sucesso` 
      });

    } catch (error) {
      await connection.rollback();
      connection.release();
      throw error;
    }

  } catch (error) {
    console.error("Erro ao prorrogar tarefas:", error);
    res.status(500).json({ error: "Erro interno ao prorrogar tarefas" });
  }
});

// 🔶 POST /api/obrigacoes/gerar-tarefas-lote-grupo - Gerar tarefas em lote para grupo
router.post("/gerar-tarefas-lote-grupo", verifyToken, async (req, res) => {
  const { grupoId, ano, mesInicio, mesFim, selectedPairs } = req.body;

  // Função otimizada para inserir atividades base em batch
  async function clonarAtividadesBaseBatch(obrigacaoClienteIds, atividadesBase) {
    console.log(`🔍 clonarAtividadesBaseBatch: obrigacaoClienteIds.length=${obrigacaoClienteIds.length}, atividadesBase.length=${atividadesBase.length}`);
    
    if (atividadesBase.length === 0 || obrigacaoClienteIds.length === 0) {
      console.log(`⚠️ Pulando clonagem: atividadesBase=${atividadesBase.length}, obrigacaoClienteIds=${obrigacaoClienteIds.length}`);
      return;
    }
    
    // Verificar atividades existentes em batch
    const [atividadesExistentes] = await db.query(`
      SELECT DISTINCT clienteId, obrigacaoClienteId FROM obrigacoes_atividades_clientes 
      WHERE obrigacaoClienteId IN (${obrigacaoClienteIds.map(item => item.id).map(() => '?').join(',')})
    `, obrigacaoClienteIds.map(item => item.id));
    
    console.log(`🔍 Atividades existentes encontradas: ${atividadesExistentes.length}`);
    
    const existentesSet = new Set(atividadesExistentes.map(e => `${e.clienteId}|${e.obrigacaoClienteId}`));
    
    // Preparar inserções em batch
    const values = [];
    for (const { clienteId, id: obrigacaoClienteId } of obrigacaoClienteIds) {
      const chave = `${clienteId}|${obrigacaoClienteId}`;
      if (!existentesSet.has(chave)) {
        console.log(`🔍 Inserindo atividades para cliente ${clienteId}, obrigacaoClienteId ${obrigacaoClienteId}`);
        for (const atv of atividadesBase) {
          values.push([clienteId, obrigacaoClienteId, atv.tipo, atv.texto, atv.descricao, atv.tipoCancelamento, atv.ordem]);
        }
      } else {
        console.log(`⚠️ Atividades já existem para cliente ${clienteId}, obrigacaoClienteId ${obrigacaoClienteId}`);
      }
    }
    
    console.log(`🔍 Total de valores para inserir: ${values.length}`);
    
    if (values.length > 0) {
    const placeholders = values.map(() => "(?, ?, ?, ?, ?, ?, ?)").join(", ");
    const flatValues = values.flat();
    await db.query(`
      INSERT INTO obrigacoes_atividades_clientes
      (cliente_id, obrigacao_cliente_id, tipo, texto, descricao, tipo_cancelamento, ordem)
      VALUES ${placeholders}
    `, flatValues);
      console.log(`✅ Inseridas ${values.length} atividades em batch`);
    } else {
      console.log(`⚠️ Nenhuma atividade para inserir`);
    }
  }

  function calcularAnoReferencia(anoAtual, fatoGerador) {
    switch (fatoGerador) {
      case "6 anos anteriores": return anoAtual - 6;
      case "5 anos anteriores": return anoAtual - 5;
      case "4 anos anteriores": return anoAtual - 4;
      case "3 anos anteriores": return anoAtual - 3;
      case "2 anos anteriores": return anoAtual - 2;
      case "Ano anterior": return anoAtual - 1;
      case "Próximo ano": return anoAtual + 1;
      case "Mesmo ano":
      default: return anoAtual;
    }
  }

  function calcularMesReferencia(mesVencimento, fatoGerador) {
    switch (fatoGerador) {
      case "Mês anterior":
        const mesAnterior = mesVencimento - 1;
        return mesAnterior < 1 ? 12 : mesAnterior;
      case "Próximo mês":
        const proximoMes = mesVencimento + 1;
        return proximoMes > 12 ? 1 : proximoMes;
      case "Mesmo mês":
      default:
        return mesVencimento;
    }
  }

  const MAX_PARALLEL = 20; // Aumentado para melhor performance
  
  // Função otimizada para inserir responsáveis em batch
  async function inserirResponsaveisBatch(obrigacaoClienteIds, obrigacaoId, responsaveisIndividuaisMap, responsaveisGlobais) {
    if (obrigacaoClienteIds.length === 0) return;
    
    // Buscar todos os responsáveis individuais de uma vez
    const clientesIds = [...new Set(obrigacaoClienteIds.map(item => item.clienteId))];
    const [responsaveisIndividuais] = await db.query(`
      SELECT clienteId, usuarioId FROM obrigacoes_responsaveis_cliente 
      WHERE obrigacao_id = ? AND clienteId IN (${clientesIds.map(() => '?').join(',')})
    `, [obrigacaoId, ...clientesIds]);
    
    const responsaveisIndividuaisMapBatch = new Map();
    for (const r of responsaveisIndividuais) {
      responsaveisIndividuaisMapBatch.set(r.clienteId, r.usuarioId);
    }
    
    // Preparar inserções de responsáveis em batch
    const responsaveisValues = [];
    for (const { id: obrigacaoClienteId, clienteId } of obrigacaoClienteIds) {
      const responsavelIndividual = responsaveisIndividuaisMapBatch.get(clienteId);
      const responsaveisParaInserir = responsavelIndividual ? [{ usuarioId: responsavelIndividual }] : responsaveisGlobais;
      
      for (const resp of responsaveisParaInserir) {
        responsaveisValues.push([obrigacaoClienteId, resp.usuarioId]);
      }
    }
    
    if (responsaveisValues.length > 0) {
      const placeholders = responsaveisValues.map(() => "(?, ?)").join(", ");
      const flatValues = responsaveisValues.flat();
      await db.query(`
        INSERT IGNORE INTO obrigacoes_clientes_responsaveis (obrigacaoClienteId, usuarioId)
        VALUES ${placeholders}
      `, flatValues);
    }
  }

  async function processarLote(lote, atividadesBase, obrigacao, responsaveisIndividuaisMap, responsaveisGlobais) {
    // Verificar existentes em batch
    const existentesConditions = lote.map(() => "(clienteId = ? AND obrigacaoId = ? AND ano_referencia = ? AND mes_referencia = ?)").join(" OR ");
    const existentesParams = lote.flatMap(item => [item.clienteId, obrigacao.id, item.anoCalc, item.mesReferencia]);
    
    const [existentes] = await db.query(`
      SELECT clienteId, obrigacaoId, ano_referencia, mes_referencia FROM obrigacoes_clientes
      WHERE ${existentesConditions}
    `, existentesParams);
    
    const existentesSet = new Set(existentes.map(e => `${e.clienteId}|${e.obrigacaoId}|${e.ano_referencia}|${e.mes_referencia}`));
    
    // Filtrar apenas os que não existem
    const loteFiltrado = lote.filter(item => 
      !existentesSet.has(`${item.clienteId}|${obrigacao.id}|${item.anoCalc}|${item.mesReferencia}`)
    );
    
    if (loteFiltrado.length === 0) return;
    
    // Inserir tarefas em batch
    const tarefasValues = loteFiltrado.map(item => [
      item.clienteId,
      obrigacao.id,
      obrigacao.nome,
      `Obrigação ${obrigacao.nome} de ${String(item.mesReferencia).padStart(2, "0")}/${item.anoCalc}`,
      'pendente',
      item.anoCalc,
      item.mesReferencia,
      item.vencimento,
      responsaveisIndividuaisMap.get(item.clienteId) || null,
      item.acao,
      item.meta
    ]);
    
    console.log(`🔍 Inserindo ${tarefasValues.length} tarefas no banco para obrigação ${obrigacao.id}`);
    
    const placeholders = tarefasValues.map(() => "(?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?)").join(", ");
    const flatValues = tarefasValues.flat();
    
    const [insertResult] = await db.query(`
      INSERT INTO obrigacoes_clientes
      (clienteId, obrigacaoId, nome, descricao, status, ano_referencia, mes_referencia, vencimento, dataCriacao, responsavelId, acao, meta)
      VALUES ${placeholders}
    `, flatValues);
    
    console.log(`✅ Tarefas inseridas com sucesso! InsertId: ${insertResult.insertId}, AffectedRows: ${insertResult.affectedRows}`);
    
    // Buscar IDs inseridos
    const [inseridos] = await db.query(`
      SELECT id, clienteId FROM obrigacoes_clientes 
      WHERE obrigacao_id = ? AND clienteId IN (${loteFiltrado.map(() => '?').join(',')})
      ORDER BY id DESC LIMIT ?
    `, [obrigacao.id, ...loteFiltrado.map(item => item.clienteId), loteFiltrado.length]);
    
    // Inserir responsáveis em batch
    await inserirResponsaveisBatch(inseridos, obrigacao.id, responsaveisIndividuaisMap, responsaveisGlobais);
    
    // Inserir atividades em batch
    await clonarAtividadesBaseBatch(inseridos, atividadesBase);
  }

  try {
    if (!grupoId || !ano || !mesInicio || !mesFim || !selectedPairs || !Array.isArray(selectedPairs)) {
      return res.status(400).json({ 
        erro: 'Todos os campos são obrigatórios: grupoId, ano, mesInicio, mesFim, selectedPairs' 
      });
    }

    // Buscar obrigações do grupo com responsáveis
    const [obrigacoesGrupo] = await db.query(`
      SELECT DISTINCT o.id, o.nome, o.frequencia, o.diaSemana, o.vencimentoTipo, o.vencimentoDia, 
             o.fatoGerador, o.acaoQtdDias, o.acaoTipoDias, o.metaQtdDias, o.metaTipoDias
      FROM obrigacoes o
      INNER JOIN obrigacoes_responsaveis_cliente orc ON o.id = orc.obrigacaoId
      WHERE o.empresaId = (SELECT empresaId FROM clientes_grupos_vinculo WHERE grupoId = ? LIMIT 1)
    `, [grupoId]);

    if (obrigacoesGrupo.length === 0) {
      return res.status(404).json({ 
        erro: 'Nenhuma obrigação com responsáveis encontrada para este grupo' 
      });
    }

    // Agrupar pares por obrigação para processar em lote
    const obrigacoesMap = new Map();
    for (const pair of selectedPairs) {
      const [clienteId, obrigacaoId] = pair.split(':').map(Number);
      if (!obrigacoesMap.has(obrigacaoId)) {
        obrigacoesMap.set(obrigacaoId, []);
      }
      obrigacoesMap.get(obrigacaoId).push(clienteId);
    }

    // Processar cada obrigação com todos os seus clientes
    const tarefasGeradas = [];

    for (const [obrigacaoId, clientesIds] of obrigacoesMap) {
      // Buscar dados da obrigação
      const [obrigacoes] = await db.query(`SELECT * FROM obrigacoes WHERE id = ?`, [obrigacaoId]);
      const obrigacao = obrigacoes[0];
      if (!obrigacao) continue;

      const [atividadesBase] = await db.query(`SELECT * FROM atividades_obrigacao WHERE obrigacaoId = ?`, [obrigacaoId]);
      console.log(`🔍 Atividades base encontradas para obrigacaoId ${obrigacaoId}: ${atividadesBase.length}`);

          // Buscar responsáveis individuais e globais em uma única query
    const [responsaveis] = await db.query(`
      SELECT clienteId, usuarioId
      FROM obrigacoes_responsaveis_cliente
      WHERE obrigacao_id = ? AND (clienteId IN (${clientesIds.map(() => '?').join(',')}) OR clienteId IS NULL)
      `, [obrigacaoId, ...clientesIds]);
      
      const responsaveisIndividuaisMap = new Map();
    let responsaveisGlobais = [];
    
    for (const r of responsaveis) {
      if (r.clienteId === null) {
        responsaveisGlobais.push({ usuarioId: r.usuarioId });
      } else {
        responsaveisIndividuaisMap.set(r.clienteId, r.usuarioId);
      }
    }

      // Buscar todas as particularidades em uma única query
      const [particularidades] = await db.query(`
        SELECT tipo, particularidadeId FROM obrigacoes_particularidades WHERE obrigacaoId = ?
      `, [obrigacaoId]);
      
      const partE = particularidades.filter(p => p.tipo === 'E').map(p => p.particularidadeId);
      const partOU = particularidades.filter(p => p.tipo === 'OU').map(p => p.particularidadeId);
      const partEXCETO = particularidades.filter(p => p.tipo === 'EXCETO').map(p => p.particularidadeId);

      // Verificar quais clientes atende às particularidades
      const [respostasClientes] = await db.query(`
        SELECT cr.clienteId, er.particularidadeId
        FROM cliente_respostas cr
        JOIN enquete_respostas er ON cr.respostaId = er.id
        WHERE cr.clienteId IN (${clientesIds.map(() => '?').join(',')})
      `, clientesIds);

      const clientesValidos = [];
      const clienteParticularidadesMap = new Map();
      
      // Agrupar particularidades por cliente
      for (const resp of respostasClientes) {
        if (!clienteParticularidadesMap.has(resp.clienteId)) {
          clienteParticularidadesMap.set(resp.clienteId, new Set());
        }
        clienteParticularidadesMap.get(resp.clienteId).add(resp.particularidadeId);
      }

      // Verificar cada cliente
      for (const clienteId of clientesIds) {
        const clienteParticularidades = clienteParticularidadesMap.get(clienteId) || new Set();
        const atendeTodasE = partE.every(pid => clienteParticularidades.has(pid));
        const atendeAlgumaOU = partOU.length === 0 || partOU.some(pid => clienteParticularidades.has(pid));
        const temAlgumExceto = partEXCETO.length > 0 && partEXCETO.some(pid => clienteParticularidades.has(pid));
        
        if (atendeTodasE && atendeAlgumaOU && !temAlgumExceto) {
          clientesValidos.push(clienteId);
        }
      }

      console.log(`🔍 Clientes válidos para obrigação ${obrigacaoId}: ${clientesValidos.length}`);
      
      if (clientesValidos.length === 0) {
        console.log(`⚠️ Nenhum cliente válido para obrigação ${obrigacaoId}, pulando...`);
        continue;
      }

      // Frequências
      let meses = [];
      
      console.log(`🔍 Processando obrigação ${obrigacaoId} com frequência: ${obrigacao.frequencia}`);
      console.log(`🔍 Período: ${mesInicio} a ${mesFim} do ano ${ano}`);
      
      switch (obrigacao.frequencia) {
        case "Mensal":        
          console.log(`🔍 PROCESSANDO OBRIGAÇÃO MENSAL ${obrigacaoId}`);
          
          // Lógica específica para obrigações mensais (copiada do gerar-atividades)
          const anoReferenciaMensal = calcularAnoReferencia(ano, obrigacao.fatoGerador);
          const tarefasParaCriarMensal = [];
          
          console.log(`🔍 Ano de referência: ${anoReferenciaMensal} (fato gerador: ${obrigacao.fatoGerador})`);
          
          // Gerar meses de vencimento
          for (let i = mesInicio; i <= mesFim; i++) meses.push(i);
          console.log(`🔍 Meses de vencimento: ${meses.join(', ')}`);
          
          for (const mesVencimento of meses) {
            console.log(`🔍 Processando mês de vencimento: ${mesVencimento}`);
            
            // Calcular mês de referência baseado no fato gerador
            let mesCompetencia = calcularMesReferencia(mesVencimento, obrigacao.fatoGerador);
            let anoCompetencia = anoReferenciaMensal;
        
            // Ajustar ano se necessário quando o mês muda
            if (obrigacao.fatoGerador === 'Mês anterior' && mesCompetencia === 12 && mesVencimento === 1) {
              anoCompetencia = anoReferenciaMensal - 1;
            } else if (obrigacao.fatoGerador === 'Próximo mês' && mesCompetencia === 1 && mesVencimento === 12) {
              anoCompetencia = anoReferenciaMensal + 1;
            }
            
            console.log(`🔍 Mês competência: ${mesCompetencia}, Ano competência: ${anoCompetencia}`);
            
            const vencimento = calcularVencimento(
              ano, // ano de vencimento sempre é o ano atual
              mesVencimento,
              obrigacao.vencimentoTipo,
              obrigacao.vencimentoDia,
              obrigacao.fatoGerador
            );
            
            console.log(`🔍 Vencimento: ${vencimento}`);
            
            // Calcular acao/meta
            const meta = obrigacao.metaQtdDias != null && obrigacao.metaTipoDias ? subtrairDias(vencimento, obrigacao.metaQtdDias, obrigacao.metaTipoDias).toISOString().split("T")[0] : null;
            const acao = obrigacao.acaoQtdDias != null && obrigacao.acaoTipoDias ? subtrairDias(meta, obrigacao.acaoQtdDias, obrigacao.acaoTipoDias).toISOString().split("T")[0] : null;
            
            for (const clienteId of clientesValidos) {
              const tarefa = {
                clienteId,
                anoCalc: anoCompetencia,
                mesReferencia: mesCompetencia,
                vencimento,
                nomeObrigacao: `${obrigacao.nome} de ${String(mesCompetencia).padStart(2, "0")}/${anoCompetencia}`,
                acao,
                meta,
              };
              
              console.log(`🔍 Tarefa mensal criada:`, tarefa);
              tarefasParaCriarMensal.push(tarefa);
            }
          }
          
          console.log(`🔍 Total de tarefas mensais a criar: ${tarefasParaCriarMensal.length}`);
          
          if (tarefasParaCriarMensal.length > 0) {
            console.log(`🔍 Processando ${tarefasParaCriarMensal.length} tarefas mensais em lotes de ${MAX_PARALLEL}`);
            for (let i = 0; i < tarefasParaCriarMensal.length; i += MAX_PARALLEL) {
              const lote = tarefasParaCriarMensal.slice(i, i + MAX_PARALLEL);
              console.log(`🔍 Processando lote mensal ${Math.floor(i/MAX_PARALLEL) + 1} com ${lote.length} tarefas`);
              await processarLote(lote, atividadesBase, obrigacao, responsaveisIndividuaisMap, responsaveisGlobais);
            }
          }
          
          console.log(`🔍 FINALIZANDO obrigação mensal ${obrigacaoId} - ${tarefasParaCriarMensal.length} tarefas criadas`);
          tarefasGeradas.push({ obrigacaoId, clientesValidos, quantidade: tarefasParaCriarMensal.length });
          continue;
        case "Bimestral":     
          for (let i = mesInicio; i <= mesFim; i += 2) meses.push(i); 
          // Não fazer break aqui - deixar continuar para o default
        case "Trimestral":
        case "Trimestral 2 Cotas":
        case "Trimestral 3 Cotas": 
          for (let i = mesInicio; i <= mesFim; i += 3) meses.push(i); 
          // Não fazer break aqui - deixar continuar para o default
        case "Quadrimestral": 
          for (let i = mesInicio; i <= mesFim; i += 4) meses.push(i); 
          // Não fazer break aqui - deixar continuar para o default
        case "Semestral":     
          for (let i = mesInicio; i <= mesFim; i += 6) meses.push(i); 
          // Não fazer break aqui - deixar continuar para o default
        case "Anual":
          // 🎯 CORREÇÃO: Obrigações anuais devem usar o campo diaSemana como mês
          const mesAnual3 = obterMesDoDiaSemana(obrigacao.diaSemana);
          if (mesAnual3) {
            // Lógica inteligente: verificar se o mês ainda cabe no ano atual
            const mesAtual3 = new Date().getMonth() + 1; // Mês atual (1-12)
            
            if (mesAnual3 >= mesInicio && mesAnual3 <= mesFim) {
              // Mês está dentro do período selecionado
              meses = [mesAnual3];
              console.log(`📌 Obrigação anual configurada para mês: ${mesAnual3} (${obrigacao.diaSemana}) - dentro do período`);
            } else if (mesAnual3 < mesAtual3 && mesInicio <= 12) {
              // Mês já passou no ano atual, mas usuário pode querer gerar para o próximo ano
              const mesProximoAno3 = mesAnual3;
              if (mesProximoAno3 >= 1 && mesProximoAno3 <= 12) {
                meses = [mesProximoAno3];
                console.log(`📌 Obrigação anual configurada para mês: ${mesProximoAno3} (${obrigacao.diaSemana}) - próximo ano`);
              } else {
                meses = [];
                console.log(`⚠️ Mês anual ${mesAnual3} (${obrigacao.diaSemana}) não pode ser processado`);
              }
            } else {
              meses = [];
              console.log(`⚠️ Mês anual ${mesAnual3} (${obrigacao.diaSemana}) fora do período ${mesInicio}-${mesFim}`);
            }
          } else {
            console.log(`⚠️ Mês anual inválido: ${obrigacao.diaSemana}`);
            meses = [];
          }
          break;
        case "Esporadica":    
          meses = [mesInicio]; 
          // Não fazer break aqui - deixar continuar para o default
        case "Diário":
          const hoje = new Date();
          hoje.setHours(0, 0, 0, 0);
          // Buscar todas as obrigações já existentes para o período, todos os clientes e obrigação
          const [existentesDiario] = await db.query(`
            SELECT clienteId, obrigacaoId, ano_referencia, mes_referencia, vencimento
            FROM obrigacoes_clientes
            WHERE obrigacao_id = ? AND ano_referencia = ? AND mes_referencia BETWEEN ? AND ?
              AND clienteId IN (${clientesValidos.map(() => '?').join(',')})
          `, [obrigacaoId, ano, mesInicio, mesFim, ...clientesValidos]);
          const existeSetDiario = new Set(existentesDiario.map(e => `${e.clienteId}|${e.obrigacaoId}|${e.ano_referencia}|${e.mes_referencia}|${e.vencimento.toISOString().slice(0,10)}`));
          const novasDiario = [];
          
          // Processar cada cliente válido
          for (const clienteId of clientesValidos) {
            for (let mes = mesInicio; mes <= mesFim; mes++) {
              const diasNoMes = new Date(ano, mes, 0).getDate();
              for (let dia = 1; dia <= diasNoMes; dia++) {
                const data = new Date(ano, mes - 1, dia);
                data.setHours(0, 0, 0, 0);
                if (data < hoje) continue;
                const weekday = data.getDay();
                if (weekday === 0 || weekday === 6) continue;
                const chave = `${clienteId}|${obrigacaoId}|${ano}|${mes}|${data.toISOString().slice(0,10)}`;
                if (existeSetDiario.has(chave)) continue;
                // Calcular acao/meta
                const vencimento = data.toISOString().split("T")[0];
                const meta = obrigacao.metaQtdDias != null && obrigacao.metaTipoDias ? subtrairDias(vencimento, obrigacao.metaQtdDias, obrigacao.metaTipoDias).toISOString().split("T")[0] : null;
                const acao = obrigacao.acaoQtdDias != null && obrigacao.acaoTipoDias ? subtrairDias(meta, obrigacao.acaoQtdDias, obrigacao.acaoTipoDias).toISOString().split("T")[0] : null;
                const responsavelId = responsaveisIndividuaisMap.get(clienteId) || responsavelGlobalId || null;
                novasDiario.push([
                  clienteId,
                  obrigacaoId,
                  obrigacao.nome,
                  `Obrigacao ${obrigacao.nome} de ${String(mes).padStart(2, "0")}/${ano}`,
                  'pendente',
                  ano,
                  mes,
                  vencimento,
                  responsavelId,
                  acao,
                  meta
                ]);
              }
            }
          }
          if (novasDiario.length) {
            const placeholders = novasDiario.map(() => "(?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?)").join(",");
            const flat = novasDiario.flat();
            const [result] = await db.query(`
              INSERT INTO obrigacoes_clientes
              (clienteId, obrigacaoId, nome, descricao, status, ano_referencia, mes_referencia, vencimento, dataCriacao, responsavelId, acao, meta)
              VALUES ${placeholders}
            `, flat);
            // Buscar os IDs inseridos para todos os clientes válidos
            const [ultimos] = await db.query(`
              SELECT id, clienteId FROM obrigacoes_clientes 
              WHERE obrigacao_id = ? AND ano_referencia = ? AND mes_referencia BETWEEN ? AND ? 
              AND clienteId IN (${clientesValidos.map(() => '?').join(',')})
            `, [obrigacaoId, ano, mesInicio, mesFim, ...clientesValidos]);
            
            const insertedIds = ultimos.map(row => ({ id: row.id, clienteId: row.clienteId }));
              
            // Inserir responsáveis e atividades em batch
            await inserirResponsaveisBatch(insertedIds, obrigacaoId, responsaveisIndividuaisMap, responsaveisGlobais);
            await clonarAtividadesBaseBatch(insertedIds, atividadesBase);
            }
          tarefasGeradas.push({ obrigacaoId, clientesValidos, quantidade: novasDiario.length });
          continue;
        case "Semanal":
          const hojeSemanal = new Date();
          hojeSemanal.setHours(0, 0, 0, 0);
          const diaSemanaMap = {
            Domingo: 0, Segunda: 1, Terca: 2, Terça: 2, Quarta: 3, Quinta: 4, Sexta: 5, Sabado: 6,
          };
          const diaAlvo = diaSemanaMap[obrigacao.diaSemana];
          if (diaAlvo === undefined) continue;
          // Buscar todas as obrigações já existentes para o período, todos os clientes e obrigação
          const [existentesSemanal] = await db.query(`
            SELECT clienteId, obrigacaoId, ano_referencia, mes_referencia, vencimento
            FROM obrigacoes_clientes
            WHERE obrigacao_id = ? AND ano_referencia = ? AND mes_referencia BETWEEN ? AND ?
              AND clienteId IN (${clientesValidos.map(() => '?').join(',')})
          `, [obrigacaoId, ano, mesInicio, mesFim, ...clientesValidos]);
          const existeSetSemanal = new Set(existentesSemanal.map(e => `${e.clienteId}|${e.obrigacaoId}|${e.ano_referencia}|${e.mes_referencia}|${e.vencimento.toISOString().slice(0,10)}`));
          const novasSemanal = [];
          
          // Processar cada cliente válido
          for (const clienteId of clientesValidos) {
            for (let mes = mesInicio; mes <= mesFim; mes++) {
              const diasNoMes = new Date(ano, mes, 0).getDate();
              for (let dia = 1; dia <= diasNoMes; dia++) {
                const data = new Date(ano, mes - 1, dia);
                data.setHours(0, 0, 0, 0);
                if (data < hojeSemanal) continue;
                if (data.getDay() !== diaAlvo) continue;
                const chave = `${clienteId}|${obrigacaoId}|${ano}|${mes}|${data.toISOString().slice(0,10)}`;
                if (existeSetSemanal.has(chave)) continue;
                // Calcular acao/meta
                const vencimento = data.toISOString().split("T")[0];
                const meta = obrigacao.metaQtdDias != null && obrigacao.metaTipoDias ? subtrairDias(vencimento, obrigacao.metaQtdDias, obrigacao.metaTipoDias).toISOString().split("T")[0] : null;
                const acao = obrigacao.acaoQtdDias != null && obrigacao.acaoTipoDias ? subtrairDias(meta, obrigacao.acaoQtdDias, obrigacao.acaoTipoDias).toISOString().split("T")[0] : null;
                const responsavelId = responsaveisIndividuaisMap.get(clienteId) || responsavelGlobalId || null;
                novasSemanal.push([
                  clienteId,
                  obrigacaoId,
                  obrigacao.nome,
                  `Obrigacao ${obrigacao.nome} de ${String(mes).padStart(2, "0")}/${ano}`,
                  'pendente',
                  ano,
                  mes,
                  vencimento,
                  responsavelId,
                  acao,
                  meta
                ]);
              }
            }
          }
          if (novasSemanal.length) {
            const placeholders = novasSemanal.map(() => "(?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?)").join(",");
            const flat = novasSemanal.flat();
            const [result] = await db.query(`
              INSERT INTO obrigacoes_clientes
              (clienteId, obrigacaoId, nome, descricao, status, ano_referencia, mes_referencia, vencimento, dataCriacao, responsavelId, acao, meta)
              VALUES ${placeholders}
            `, flat);
            // Buscar os IDs inseridos para todos os clientes válidos
            const [ultimos] = await db.query(`
              SELECT id, clienteId FROM obrigacoes_clientes 
              WHERE obrigacao_id = ? AND ano_referencia = ? AND mes_referencia BETWEEN ? AND ? 
              AND clienteId IN (${clientesValidos.map(() => '?').join(',')})
            `, [obrigacaoId, ano, mesInicio, mesFim, ...clientesValidos]);
            
            const insertedIds = ultimos.map(row => ({ id: row.id, clienteId: row.clienteId }));
              
            // Inserir responsáveis e atividades em batch
            await inserirResponsaveisBatch(insertedIds, obrigacaoId, responsaveisIndividuaisMap, responsaveisGlobais);
            await clonarAtividadesBaseBatch(insertedIds, atividadesBase);
            }
          tarefasGeradas.push({ obrigacaoId, clientesValidos, quantidade: novasSemanal.length });
          continue;
        default:
          // Para frequências que não são Diário ou Semanal (Mensal, Bimestral, etc.)
          console.log(`🔍 ENTRANDO NO DEFAULT - Obrigação ${obrigacaoId}`);
          console.log(`🔍 Meses a processar para obrigação ${obrigacaoId}: ${meses.length}`);
          console.log(`🔍 Array de meses:`, meses);
          
          if (meses.length === 0) {
            console.log(`⚠️ Nenhum mês para processar na obrigação ${obrigacaoId}, pulando...`);
            continue;
          }

          // Lógica de fato gerador - define o ano e mês de referência baseado no fato gerador
          const anoReferencia = calcularAnoReferencia(ano, obrigacao.fatoGerador);
          const tarefasParaCriar = [];
          
          console.log(`🔍 Ano de referência calculado: ${anoReferencia} (fato gerador: ${obrigacao.fatoGerador})`);
          console.log(`🔍 Processando ${clientesValidos.length} clientes para ${meses.length} meses`);
          
          // Processar cada cliente válido
          for (const clienteId of clientesValidos) {
            console.log(`🔍 Processando cliente ${clienteId}`);
            for (const mesVencimento of meses) {
              console.log(`🔍 Processando mês de vencimento: ${mesVencimento}`);
              
              // Calcular mês de referência baseado no fato gerador
              let mesCompetencia = calcularMesReferencia(mesVencimento, obrigacao.fatoGerador);
              let anoCompetencia = anoReferencia;
          
              // Ajustar ano se necessário quando o mês muda
              if (obrigacao.fatoGerador === 'Mês anterior' && mesCompetencia === 12 && mesVencimento === 1) {
                anoCompetencia = anoReferencia - 1;
              } else if (obrigacao.fatoGerador === 'Próximo mês' && mesCompetencia === 1 && mesVencimento === 12) {
                anoCompetencia = anoReferencia + 1;
              }
              
              console.log(`🔍 Mês de competência: ${mesCompetencia}, Ano de competência: ${anoCompetencia}`);
              
              const vencimento = calcularVencimento(
                ano, // ano de vencimento sempre é o ano atual
                mesVencimento,
                obrigacao.vencimentoTipo,
                obrigacao.vencimentoDia,
                obrigacao.fatoGerador
              );
              
              console.log(`🔍 Vencimento calculado: ${vencimento}`);
              
              // Calcular acao/meta
              const meta = obrigacao.metaQtdDias != null && obrigacao.metaTipoDias ? subtrairDias(vencimento, obrigacao.metaQtdDias, obrigacao.metaTipoDias).toISOString().split("T")[0] : null;
              const acao = obrigacao.acaoQtdDias != null && obrigacao.acaoTipoDias ? subtrairDias(meta, obrigacao.acaoQtdDias, obrigacao.acaoTipoDias).toISOString().split("T")[0] : null;
              
              const tarefa = {
                clienteId,
                anoCalc: anoCompetencia, // ano de referência baseado no fato gerador
                mesReferencia: mesCompetencia,
                vencimento,
                nomeObrigacao: `${obrigacao.nome} de ${String(mesCompetencia).padStart(2, "0")}/${anoCompetencia}`,
                acao,
                meta,
              };
              
              console.log(`🔍 Tarefa criada:`, tarefa);
              tarefasParaCriar.push(tarefa);
            }
          }
          
          console.log(`🔍 Tarefas a criar para obrigação ${obrigacaoId}: ${tarefasParaCriar.length}`);
          
          if (tarefasParaCriar.length > 0) {
            console.log(`🔍 Processando ${tarefasParaCriar.length} tarefas em lotes de ${MAX_PARALLEL}`);
            for (let i = 0; i < tarefasParaCriar.length; i += MAX_PARALLEL) {
              const lote = tarefasParaCriar.slice(i, i + MAX_PARALLEL);
              console.log(`🔍 Processando lote ${Math.floor(i/MAX_PARALLEL) + 1} com ${lote.length} tarefas`);
              await processarLote(lote, atividadesBase, obrigacao, responsaveisIndividuaisMap, responsaveisGlobais);
            }
          } else {
            console.log(`⚠️ Nenhuma tarefa para criar na obrigação ${obrigacaoId}`);
          }
          
          console.log(`🔍 FINALIZANDO obrigação ${obrigacaoId} - ${tarefasParaCriar.length} tarefas criadas`);
          tarefasGeradas.push({ obrigacaoId, clientesValidos, quantidade: tarefasParaCriar.length });
          continue;
        }
    }

    const totalTarefas = tarefasGeradas.reduce((sum, item) => sum + item.quantidade, 0);
    
    console.log(`📊 RESUMO FINAL:`);
    console.log(`📊 Total de tarefas geradas: ${totalTarefas}`);
    console.log(`📊 Combinações processadas: ${tarefasGeradas.length}`);
    console.log(`📊 Detalhes:`, tarefasGeradas);
    
    res.status(200).json({ 
      ok: true, 
      mensagem: `Tarefas geradas com sucesso! Total: ${totalTarefas} tarefas para ${tarefasGeradas.length} combinações cliente/obrigação.`,
      totalTarefas,
      combinacoesProcessadas: tarefasGeradas.length,
      detalhes: tarefasGeradas
    });
  } catch (err) {
    console.error("Erro ao gerar tarefas em lote para grupo:", err);
    res.status(500).json({ erro: 'Erro ao gerar tarefas em lote para grupo' });
  }
});

module.exports = router;
