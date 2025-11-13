const express = require("express");
const router = express.Router();
const db = require("../../config/database");
const verifyToken = require("../../middlewares/auth");

// ===== ROTAS PARA TABELA CLIENTES =====

// Enums para validação
const REGIME_TRIBUTARIO_OPTIONS = ['simples_nacional', 'regime_normal'];

// POST /clientes - Criar novo cliente
router.post("/", verifyToken, async (req, res) => {
  try {
    const { 
      empresa_id, 
      razao_social, 
      cpf_cnpj, 
      estado, 
      regime_tributario
    } = req.body;
    
    // Validações obrigatórias
    if (!empresa_id || !razao_social || !cpf_cnpj || !estado) {
      return res.status(400).json({ 
        error: "Todos os campos são obrigatórios: empresa_id, razao_social, cpf_cnpj, estado" 
      });
    }

    // Validar formato do CNPJ (14 dígitos)
    if (!/^\d{14}$/.test(cpf_cnpj.replace(/\D/g, ''))) {
      return res.status(400).json({ 
        error: "CNPJ deve ter 14 dígitos" 
      });
    }

    // Validar UF (2 caracteres)
    if (!/^[A-Z]{2}$/.test(estado)) {
      return res.status(400).json({ 
        error: "UF deve ter 2 caracteres maiúsculos" 
      });
    }

    // Validar regime_tributario (enum)
    if (regime_tributario && !REGIME_TRIBUTARIO_OPTIONS.includes(regime_tributario)) {
      return res.status(400).json({ 
        error: "regime_tributario deve ser 'simples_nacional' ou 'regime_normal'" 
      });
    }

    // Verificar se cliente já existe para este empresa_id e cnpj
    const [rows] = await db.query('SELECT id FROM clientes WHERE empresa_id = ? AND cpf_cnpj = ? LIMIT 1', [empresa_id, cpf_cnpj]);

    if (rows.length > 0) {
      return res.status(400).json({ 
        error: "Cliente já existe para este CNPJ" 
      });
    }

    const [result] = await db.query('INSERT INTO clientes (empresa_id, razao_social, cpf_cnpj, estado, regime_tributario) VALUES (?, ?, ?, ?, ?)', [empresa_id, razao_social, cpf_cnpj, estado, regime_tributario]);
    let data = null;
    if (result && result.insertId) {
      [[data]] = await db.query('SELECT * FROM clientes WHERE id = ?', [result.insertId]);
    }

    res.status(201).json(data);
  } catch (err) {
    console.error('Erro ao criar cliente:', err);
    res.status(500).json({ error: "Erro interno do servidor." });
  }
});

// GET /clientes - Listar clientes com filtros
router.get("/", verifyToken, async (req, res) => {
  try {
    const {
      empresa_id,
      cpf_cnpj,
      estado,
      nome,
      simples_nacional,
      regime_tributario,
      page = 1,
      limit = 50,
      sort_by = 'created_at',
      sort_order = 'desc'
    } = req.query;

    if (!empresa_id) {
      return res.status(400).json({
        error: "empresa_id é obrigatório"
      });
    }

    const empresaIdNumber = Number(empresa_id);
    if (Number.isNaN(empresaIdNumber)) {
      return res.status(400).json({
        error: "empresa_id deve ser numérico"
      });
    }

    // Apenas validação de existência de empresa_id segue normalmente.

    const filters = ["empresa_id = ?"];
    const params = [empresaIdNumber];

    if (cpf_cnpj) {
      const sanitizedCnpj = cpf_cnpj.replace(/\D/g, "");
      filters.push("cpf_cnpj = ?");
      params.push(sanitizedCnpj);
    }

    if (estado) {
      filters.push("estado = ?");
      params.push(estado.toUpperCase());
    }

    if (nome) {
      filters.push("(nome_fantasia LIKE ? OR razao_social LIKE ?)");
      params.push(`%${nome}%`, `%${nome}%`);
    }

    if (regime_tributario) {
      filters.push("regime_tributario = ?");
      params.push(regime_tributario);
    } else if (simples_nacional !== undefined) {
      if (simples_nacional === 'true' || simples_nacional === 'sim') {
        filters.push("regime_tributario = ?");
        params.push('simples_nacional');
      } else if (simples_nacional === 'false' || simples_nacional === 'nao') {
        filters.push("regime_tributario <> ?");
        params.push('simples_nacional');
      }
    }

    const allowedSorts = {
      nome: "nome_fantasia",
      cpf_cnpj: "cpf_cnpj",
      estado: "estado",
      created_at: "criado_em",
      updated_at: "atualizado_em"
    };

    const sortField = allowedSorts[sort_by] || "criado_em";
    const sortDirection = sort_order === 'asc' ? 'ASC' : 'DESC';

    const limitNumber = Math.max(parseInt(limit, 10) || 50, 1);
    const pageNumber = Math.max(parseInt(page, 10) || 1, 1);
    const offset = (pageNumber - 1) * limitNumber;

    const baseQuery = `
      SELECT
        id,
        nome_fantasia AS nome,
        razao_social,
        cpf_cnpj AS cpf_cnpj,
        estado AS estado,
        regime_tributario,
        empresa_id
      FROM clientes
      WHERE ${filters.join(" AND ")}
      ORDER BY ${sortField} ${sortDirection}
      LIMIT ?
      OFFSET ?
    `;

    const countQuery = `
      SELECT COUNT(*) AS total
      FROM clientes
      WHERE ${filters.join(" AND ")}
    `;

    const [rows] = await db.query(baseQuery, [...params, limitNumber, offset]);
    const [[{ total }]] = await db.query(countQuery, params);

    const data = rows.map((row) => ({
      id: row.id,
      nome: row.nome || row.razao_social || '',
      cpf_cnpj: row.cpf_cnpj,
      estado: row.estado,
      regime_tributario: row.regime_tributario,
      empresa_id: row.empresa_id
    }));

    return res.json({
      data,
      pagination: {
        page: pageNumber,
        limit: limitNumber,
        total: total || 0,
        total_pages: Math.ceil((total || 0) / limitNumber)
      }
    });
  } catch (err) {
    console.error('Erro ao buscar clientes:', err);
    res.status(500).json({ error: "Erro interno do servidor." });
  }
});

// GET /clientes/simples-nacional - Buscar clientes do Simples Nacional
router.get("/simples-nacional", verifyToken, async (req, res) => {
  try {
    const { 
      empresa_id, 
      cpf_cnpj, 
      estado, 
      nome, 
      page = 1,
      limit = 50,
      sort_by = 'created_at',
      sort_order = 'desc'
    } = req.query;

    if (!empresa_id) {
      return res.status(400).json({ 
        error: "empresa_id é obrigatório" 
      });
    }

    let query = db.query('SELECT * FROM clientes WHERE empresa_id = ? AND regime_tributario = ?', [empresa_id, 'simples_nacional']);

    // Aplicar filtros adicionais
    if (cpf_cnpj) {
      query = query.eq('cpf_cnpj', cpf_cnpj);
    }

    if (estado) {
      query = query.eq('estado', estado.toUpperCase());
    }

    if (nome) {
      query = query.ilike('nome', `%${nome}%`);
    }

    // Aplicar ordenação
    if (sort_by && ['nome', 'cpf_cnpj', 'estado', 'created_at', 'updated_at'].includes(sort_by)) {
      query = query.order(sort_by, { ascending: sort_order === 'asc' });
    } else {
      query = query.order('created_at', { ascending: false });
    }

    // Aplicar paginação
    const offset = (parseInt(page) - 1) * parseInt(limit);
    query = query.range(offset, offset + parseInt(limit) - 1);

    const { data, error } = await query;

    if (error) {
      console.error('Erro ao buscar clientes do Simples Nacional:', error);
      return res.status(500).json({ error: "Erro ao buscar clientes do Simples Nacional." });
    }

    // Buscar total de registros para paginação
    let countQuery = db.query('SELECT COUNT(*) AS total FROM clientes WHERE empresa_id = ? AND regime_tributario = ?', [empresa_id, 'simples_nacional']);

    // Aplicar os mesmos filtros na contagem
    if (cpf_cnpj) {
      countQuery = countQuery.eq('cpf_cnpj', cpf_cnpj);
    }

    if (estado) {
      countQuery = countQuery.eq('estado', estado.toUpperCase());
    }

    if (nome) {
      countQuery = countQuery.ilike('nome', `%${nome}%`);
    }

    const { count: totalCount } = await countQuery;

    res.json({
      data: data || [],
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalCount || 0,
        total_pages: Math.ceil((totalCount || 0) / parseInt(limit))
      }
    });
  } catch (err) {
    console.error('Erro ao buscar clientes do Simples Nacional:', err);
    res.status(500).json({ error: "Erro interno do servidor." });
  }
});

// GET /clientes/regime-normal - Buscar clientes do Regime Normal
router.get("/regime-normal", verifyToken, async (req, res) => {
  try {
    const { 
      empresa_id, 
      cpf_cnpj, 
      estado, 
      nome, 
      page = 1,
      limit = 50,
      sort_by = 'created_at',
      sort_order = 'desc'
    } = req.query;

    console.log('🔍 [DEBUG] Query params recebidos:', req.query);
    console.log('🔍 [DEBUG] empresa_id:', empresa_id, 'tipo:', typeof empresa_id);

    if (!empresa_id) {
      return res.status(400).json({ 
        error: "empresa_id é obrigatório" 
      });
    }

    // Validar formato UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(empresa_id)) {
      return res.status(400).json({ 
        error: "empresa_id deve ser um UUID válido",
        received: empresa_id
      });
    }

    console.log('🔍 [DEBUG] Iniciando consulta ao Supabase...');
    
    // SOLUÇÃO ROBUSTA: Buscar todos os clientes da empresa e filtrar manualmente
    // Isso evita problemas com tipos ENUM e interpretação incorreta de parâmetros
    console.log('🔍 [DEBUG] Buscando todos os clientes da empresa...');
    const [allClients] = await db.query('SELECT * FROM clientes WHERE empresa_id = ?', [empresa_id]);
        
    console.log('🔍 [DEBUG] Consulta executada - data length:', allClients?.length, 'error:', null);
    
    // Filtrar por regime_tributario = 'regime_normal'
    const regimeNormalClients = allClients?.filter(cliente => 
      cliente.regime_tributario === 'regime_normal'
    ) || [];
    
    console.log('🔍 [DEBUG] Clientes do regime normal encontrados:', regimeNormalClients.length);
    console.log('🔍 [DEBUG] Todos os regimes encontrados:', [...new Set(allClients?.map(c => c.regime_tributario))]);
    
    // Aplicar filtros adicionais manualmente
    let finalData = regimeNormalClients;
    
    if (cpf_cnpj) {
      finalData = finalData.filter(cliente => cliente.cpf_cnpj === cpf_cnpj);
      console.log('🔍 [DEBUG] Filtro CNPJ aplicado:', cpf_cnpj, '- restantes:', finalData.length);
    }

    if (estado) {
      finalData = finalData.filter(cliente => cliente.estado === estado.toUpperCase());
      console.log('🔍 [DEBUG] Filtro UF aplicado:', estado.toUpperCase(), '- restantes:', finalData.length);
    }

    if (nome) {
      finalData = finalData.filter(cliente => 
        cliente.nome.toLowerCase().includes(nome.toLowerCase())
      );
      console.log('🔍 [DEBUG] Filtro nome aplicado:', nome, '- restantes:', finalData.length);
    }

    // Aplicar ordenação manualmente
    if (sort_by && ['nome', 'cpf_cnpj', 'estado', 'created_at', 'updated_at'].includes(sort_by)) {
      finalData.sort((a, b) => {
        const aVal = a[sort_by];
        const bVal = b[sort_by];
        if (sort_order === 'asc') {
          return aVal > bVal ? 1 : -1;
        } else {
          return aVal < bVal ? 1 : -1;
        }
      });
      console.log('🔍 [DEBUG] Ordenação aplicada:', sort_by, sort_order);
    }

    // Aplicar paginação manualmente
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const paginatedData = finalData.slice(offset, offset + parseInt(limit));
    console.log('🔍 [DEBUG] Paginação aplicada - offset:', offset, 'limit:', limit, 'resultado:', paginatedData.length);

    res.json({
      data: paginatedData,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: finalData.length,
        total_pages: Math.ceil(finalData.length / parseInt(limit))
      }
    });
    
    return;
  } catch (err) {
    console.error('Erro ao buscar clientes do Regime Normal:', err);
    res.status(500).json({ error: "Erro interno do servidor." });
  }
});

// GET /clientes/:id - Buscar cliente por ID
router.get("/:id", verifyToken, async (req, res) => {
  try {
    const [data] = await db.query('SELECT * FROM clientes WHERE id = ?', [req.params.id]);

    if (data.length === 0) {
      return res.status(404).json({ error: "Cliente não encontrado." });
    }

    // Verificar se a empresa pertence ao empresa_id do usuário
    if (!req.user.all_company_ids || !req.user.all_company_ids.includes(data[0].empresa_id)) {
      return res.status(403).json({ error: "Acesso negado a esta empresa." });
    }

    res.json(data[0]);
  } catch (err) {
    console.error('Erro ao buscar empresa:', err);
    res.status(500).json({ error: "Erro interno do servidor." });
  }
});

// PUT /empresas/:id - Atualizar empresa
router.put("/:id", verifyToken, async (req, res) => {
  try {
    const { 
      nome, 
      cpf_cnpj, 
      estado,
      regime_tributario
    } = req.body;

    // Buscar empresa existente para validações
    const [existingEmpresa] = await db.query('SELECT * FROM clientes WHERE id = ?', [req.params.id]);

    if (existingEmpresa.length === 0) {
      return res.status(404).json({ error: "Empresa não encontrada." });
    }

    // Verificar se a empresa pertence ao empresa_id do usuário
    if (!req.user.all_company_ids || !req.user.all_company_ids.includes(existingEmpresa[0].empresa_id)) {
      return res.status(403).json({ error: "Acesso negado a esta empresa." });
    }

    // Validações
    if (nome && !nome.trim()) {
      return res.status(400).json({ error: "Nome não pode estar vazio" });
    }

    if (cpf_cnpj && !/^\d{14}$/.test(cpf_cnpj.replace(/\D/g, ''))) {
      return res.status(400).json({ error: "CNPJ deve ter 14 dígitos" });
    }

    if (estado && !/^[A-Z]{2}$/.test(estado)) {
      return res.status(400).json({ error: "UF deve ter 2 caracteres maiúsculos" });
    }

    // Validar regime_tributario (enum)
    if (regime_tributario && !REGIME_TRIBUTARIO_OPTIONS.includes(regime_tributario)) {
      return res.status(400).json({ 
        error: "regime_tributario deve ser 'simples_nacional' ou 'regime_normal'" 
      });
    }

    // Verificar se já existe outra empresa com mesmo cnpj
    if (cpf_cnpj) {
      const [duplicateEmpresa] = await db.query('SELECT id FROM clientes WHERE empresa_id = ? AND cpf_cnpj = ? AND id <> ?', [existingEmpresa[0].empresa_id, cpf_cnpj, req.params.id]);

      if (duplicateEmpresa.length > 0) {
        return res.status(400).json({ 
          error: "Já existe empresa com este CNPJ" 
        });
      }
    }

    // Preparar dados para atualização
    const updateData = {};
    if (nome !== undefined) updateData.nome = nome;
    if (cpf_cnpj !== undefined) updateData.cpf_cnpj = cpf_cnpj;
    if (estado !== undefined) updateData.estado = estado;
    if (regime_tributario !== undefined) updateData.regime_tributario = regime_tributario;
    
    updateData.updated_by = req.user.userId;

    const [updateResult] = await db.query('UPDATE clientes SET ? WHERE id = ?', [updateData, req.params.id]);
    let updatedData = null;
    if (updateResult && updateResult.affectedRows) {
      [[updatedData]] = await db.query('SELECT * FROM clientes WHERE id = ?', [req.params.id]);
    }

    res.json(updatedData);
  } catch (err) {
    console.error('Erro ao atualizar empresa:', err);
    res.status(500).json({ error: "Erro interno do servidor." });
  }
});

// DELETE /empresas/:id - Deletar empresa
router.delete("/:id", verifyToken, async (req, res) => {
  try {
    // Buscar empresa para verificar permissões
    const [existingEmpresa] = await db.query('SELECT empresa_id FROM clientes WHERE id = ?', [req.params.id]);

    if (existingEmpresa.length === 0) {
      return res.status(404).json({ error: "Empresa não encontrada." });
    }

    // Verificar se a empresa pertence ao empresa_id do usuário
    if (!req.user.all_company_ids || !req.user.all_company_ids.includes(existingEmpresa[0].empresa_id)) {
      return res.status(403).json({ 
        error: "Acesso negado a esta empresa.",
        user_company_ids: req.user.all_company_ids,
        empresa_company_id: existingEmpresa[0].empresa_id
      });
    }

    await db.query('DELETE FROM clientes WHERE id = ?', [req.params.id]);

    res.json({ 
      success: true, 
      message: "Empresa deletada com sucesso" 
    });
  } catch (err) {
    console.error('Erro ao deletar empresa:', err);
    res.status(500).json({ error: "Erro interno do servidor." });
  }
});

// ===== ROTAS ESPECIALIZADAS =====

// GET /empresas/estatisticas - Estatísticas das empresas
router.get("/estatisticas", verifyToken, async (req, res) => {
  try {
    const { empresa_id } = req.query;

    if (!empresa_id) {
      return res.status(400).json({ 
        error: "empresa_id é obrigatório" 
      });
    }

    let query = db.query('SELECT * FROM clientes WHERE empresa_id = ?');

    const { data, error } = await query;

    if (error) {
      console.error('Erro ao buscar estatísticas:', error);
      return res.status(500).json({ error: "Erro ao buscar estatísticas." });
    }

    const empresas = data || [];

    // Calcular estatísticas
    const estatisticas = {
      total_empresas: empresas.length,
      por_uf: {},
      cnpjs_unicos: new Set(empresas.map(e => e.cpf_cnpj)).size
    };

    empresas.forEach(empresa => {
      // Por UF
      estatisticas.por_uf[empresa.estado] = (estatisticas.por_uf[empresa.estado] || 0) + 1;
    });

    // Converter Sets para números
    estatisticas.cnpjs_unicos = estatisticas.cnpjs_unicos;

    res.json(estatisticas);
  } catch (err) {
    console.error('Erro ao buscar estatísticas:', err);
    res.status(500).json({ error: "Erro interno do servidor." });
  }
});


// GET /clientes/por-cnpj/:cnpj - Buscar empresas por CNPJ
router.get("/por-cnpj/:cnpj", verifyToken, async (req, res) => {
  try {
    const { empresa_id } = req.query;
    const { cpf_cnpj } = req.params;

    if (!empresa_id) {
      return res.status(400).json({ 
        error: "empresa_id é obrigatório" 
      });
    }

    if (!cpf_cnpj || !/^\d{14}$/.test(cpf_cnpj.replace(/\D/g, ''))) {
      return res.status(400).json({ 
        error: "CNPJ inválido" 
      });
    }

    const [data] = await db.query('SELECT * FROM clientes WHERE empresa_id = ? AND cpf_cnpj = ? ORDER BY created_at DESC', [empresa_id, cpf_cnpj]);

    if (data.length === 0) {
      return res.status(404).json({ error: "Empresa não encontrada." });
    }

    res.json(data);
  } catch (err) {
    console.error('Erro ao buscar empresas por CNPJ:', err);
    res.status(500).json({ error: "Erro interno do servidor." });
  }
});

// POST /empresas/bulk - Criar múltiplas empresas
router.post("/bulk", verifyToken, async (req, res) => {
  try {
    const { empresas } = req.body;

    if (!empresas || !Array.isArray(empresas) || empresas.length === 0) {
      return res.status(400).json({ 
        error: "Array de empresas é obrigatório" 
      });
    }

    if (empresas.length > 100) {
      return res.status(400).json({ 
        error: "Máximo de 100 empresas por operação" 
      });
    }

    const empresasValidadas = [];
    const erros = [];

    // Validar cada empresa
    for (let i = 0; i < empresas.length; i++) {
      const empresa = empresas[i];
      
      if (!empresa.empresa_id || !empresa.nome || !empresa.cpf_cnpj || !empresa.estado) {
        erros.push(`Empresa ${i + 1}: Todos os campos são obrigatórios`);
        continue;
      }

      // Validar regime_tributario se fornecido
      if (empresa.regime_tributario && !REGIME_TRIBUTARIO_OPTIONS.includes(empresa.regime_tributario)) {
        erros.push(`Empresa ${i + 1}: regime_tributario deve ser 'simples_nacional' ou 'regime_normal'`);
        continue;
      }

      if (!/^\d{14}$/.test(empresa.cpf_cnpj.replace(/\D/g, ''))) {
        erros.push(`Empresa ${i + 1}: CNPJ inválido`);
        continue;
      }

      if (!/^[A-Z]{2}$/.test(empresa.estado)) {
        erros.push(`Empresa ${i + 1}: UF inválida`);
        continue;
      }

      empresasValidadas.push({
        ...empresa,
        created_by: req.user.userId,
        updated_by: req.user.userId
      });
    }

    if (erros.length > 0) {
      return res.status(400).json({ 
        error: "Erros de validação", 
        detalhes: erros 
      });
    }

    const [insertResult] = await db.query('INSERT INTO clientes (empresa_id, nome, cpf_cnpj, estado, regime_tributario, created_by, updated_by) VALUES ?', [empresasValidadas]);
    // Se necessário buscar os registros, faça um SELECT depois.

    res.status(201).json({
      message: `${insertResult.affectedRows} empresas criadas com sucesso`,
      data: insertResult.insertId ? await db.query('SELECT * FROM clientes WHERE id = ?', [insertResult.insertId]) : []
    });
  } catch (err) {
    console.error('Erro ao criar empresas em lote:', err);
    res.status(500).json({ error: "Erro interno do servidor." });
  }
});

// GET /clientes/:id/dados-consolidados - Buscar dados consolidados para gráfico
router.get("/:id/dados-consolidados", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { ano } = req.query;

    if (!id) {
      return res.status(400).json({ 
        error: "ID do cliente é obrigatório" 
      });
    }

    if (!ano) {
      return res.status(400).json({ 
        error: "Ano é obrigatório" 
      });
    }

    // Validar se o ano é um número válido
    const anoNumero = parseInt(ano);
    if (isNaN(anoNumero) || anoNumero < 1900 || anoNumero > 2100) {
      return res.status(400).json({ 
        error: "Ano deve ser um número válido entre 1900 e 2100" 
      });
    }

    // Verificar se o cliente existe e pertence ao empresa_id do usuário
    const [cliente] = await db.query('SELECT id, empresa_id FROM clientes WHERE id = ?', [id]);

    if (cliente.length === 0) {
      return res.status(404).json({ error: "Cliente não encontrado." });
    }

    // Verificar se o cliente pertence a qualquer uma das empresas do usuário
    console.log('🔍 [DEBUG] Verificando acesso ao cliente:', {
      cliente_id: id,
      cliente_empresa_id: cliente[0].empresa_id,
      user_empresa_id: req.user.empresa_id,
      user_all_company_ids: req.user.all_company_ids,
      user_id: req.user.id
    });

    if (!req.user.all_company_ids || req.user.all_company_ids.length === 0) {
      console.error('❌ [DEBUG] Usuário não possui empresas associadas');
      return res.status(403).json({ error: "Usuário não possui empresas associadas." });
    }

    if (!req.user.all_company_ids.includes(cliente[0].empresa_id)) {
      console.error('❌ [DEBUG] Cliente não pertence a nenhuma empresa do usuário');
      return res.status(403).json({ error: "Acesso negado a este cliente." });
    }

    // Buscar dados das notas fiscais para o ano especificado
    const [notasFiscais] = await db.query('SELECT valor_total_nfe, data_emissao FROM notas_fiscais WHERE clientes_id = ? AND data_emissao >= ? AND data_emissao < ?', [id, `${ano}-01-01`, `${ano + 1}-01-01`]);

    // Buscar dados das análises do Simples Nacional para o ano especificado
    const [analisesSimples] = await db.query('SELECT valor_das, receita_total, mes, ano FROM analises_simples_nacional WHERE clientes_id = ? AND ano = ?', [id, anoNumero]);

    // Processar dados das notas fiscais por mês
    const dadosPorMes = {
      '01': { mes: 'Jan', faturamentoNotas: 0, quantidadeNotas: 0 },
      '02': { mes: 'Fev', faturamentoNotas: 0, quantidadeNotas: 0 },
      '03': { mes: 'Mar', faturamentoNotas: 0, quantidadeNotas: 0 },
      '04': { mes: 'Abr', faturamentoNotas: 0, quantidadeNotas: 0 },
      '05': { mes: 'Mai', faturamentoNotas: 0, quantidadeNotas: 0 },
      '06': { mes: 'Jun', faturamentoNotas: 0, quantidadeNotas: 0 },
      '07': { mes: 'Jul', faturamentoNotas: 0, quantidadeNotas: 0 },
      '08': { mes: 'Ago', faturamentoNotas: 0, quantidadeNotas: 0 },
      '09': { mes: 'Set', faturamentoNotas: 0, quantidadeNotas: 0 },
      '10': { mes: 'Out', faturamentoNotas: 0, quantidadeNotas: 0 },
      '11': { mes: 'Nov', faturamentoNotas: 0, quantidadeNotas: 0 },
      '12': { mes: 'Dez', faturamentoNotas: 0, quantidadeNotas: 0 }
    };

    // Processar notas fiscais
    if (notasFiscais && notasFiscais.length > 0) {
      notasFiscais.forEach(nota => {
        if (nota.data_emissao) {
          const mes = nota.data_emissao.substring(5, 7); // Extrair mês (MM) da data
          const valor = parseFloat(nota.valor_total_nfe) || 0;
          
          if (dadosPorMes[mes]) {
            dadosPorMes[mes].faturamentoNotas += valor;
            dadosPorMes[mes].quantidadeNotas += 1;
          }
        }
      });
    }

    // Processar análises do Simples Nacional
    const dadosSimplesPorMes = {};
    if (analisesSimples && analisesSimples.length > 0) {
      analisesSimples.forEach(analise => {
        const mes = analise.mes?.toString().padStart(2, '0') || '01';
        const valorDas = parseFloat(analise.valor_das) || 0;
        const receitaTotal = parseFloat(analise.receita_total) || 0;
        
        if (!dadosSimplesPorMes[mes]) {
          dadosSimplesPorMes[mes] = {
            valorDas: 0,
            receitaTotal: 0
          };
        }
        
        dadosSimplesPorMes[mes].valorDas += valorDas;
        dadosSimplesPorMes[mes].receitaTotal += receitaTotal;
      });
    }

    // Consolidar dados finais
    const dadosConsolidados = Object.keys(dadosPorMes).map(mes => {
      const dadosMes = dadosPorMes[mes];
      const dadosSimples = dadosSimplesPorMes[mes] || { valorDas: 0, receitaTotal: 0 };
      
      return {
        mes: dadosMes.mes,
        mesNumero: parseInt(mes),
        ano: anoNumero,
        faturamentoNotas: dadosMes.faturamentoNotas,
        quantidadeNotas: dadosMes.quantidadeNotas,
        valorDas: dadosSimples.valorDas,
        receitaTotal: dadosSimples.receitaTotal,
        faturamentoExtrato: dadosSimples.receitaTotal // Alias para compatibilidade
      };
    });

    // Ordenar por mês
    dadosConsolidados.sort((a, b) => a.mesNumero - b.mesNumero);

    // Calcular totais
    const totais = {
      faturamentoNotas: dadosConsolidados.reduce((sum, item) => sum + item.faturamentoNotas, 0),
      quantidadeNotas: dadosConsolidados.reduce((sum, item) => sum + item.quantidadeNotas, 0),
      valorDas: dadosConsolidados.reduce((sum, item) => sum + item.valorDas, 0),
      receitaTotal: dadosConsolidados.reduce((sum, item) => sum + item.receitaTotal, 0)
    };

    res.json({
      cliente_id: id,
      ano: anoNumero,
      dados_mensais: dadosConsolidados,
      totais,
      resumo: {
        total_notas_fiscais: notasFiscais?.length || 0,
        total_analises_simples: analisesSimples?.length || 0,
        meses_com_dados: dadosConsolidados.filter(item => 
          item.faturamentoNotas > 0 || item.valorDas > 0 || item.receitaTotal > 0
        ).length
      }
    });

  } catch (err) {
    console.error('Erro ao buscar dados consolidados:', err);
    res.status(500).json({ error: "Erro interno do servidor." });
  }
});

module.exports = router;
