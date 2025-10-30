const express = require("express");
const router = express.Router();
const { importarEmpresasParaBD } = require("../../services/gestao/epluginService");
const { processarSituacaoFiscalCliente } = require("../../services/gestao/sitfisService"); // Função SitFis
const { consultarDCTFWeb } = require("../../services/gestao/dctfwebService"); // Função DCTF Web
const axios = require("axios");
const db = require('../../config/database');
const autenticarToken = require('../../middlewares/auth');
const { verificarPermissao } = require('../../middlewares/permissao');
const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });
const clienteController = require('../../controllers/gestao/clienteController');
// const { consultarTributacaoDetalhada } = require("../services/consultarTributacaoService");

// Rotas para dores e soluções fixas
router.get('/dores', clienteController.listarDores);
router.get('/solucoes', clienteController.listarSolucoes);
router.get('/mapa-dores-solucoes', clienteController.mapearDoresSolucoes);

// Opções dinâmicas de clientes
// GET /api/clientes/opcoes/status?empresaId=123
router.get('/opcoes/status', autenticarToken, verificarPermissao('clientes.visualizar'), async (req, res) => {
  try {
    const empresaId = req.query.empresaId || req.empresaId;
    if (!empresaId) return res.status(400).json({ error: 'empresaId é obrigatório.' });

    const [rows] = await db.query(
      `SELECT DISTINCT c.status FROM clientes c WHERE c.empresa_id = ? AND c.status IS NOT NULL AND TRIM(c.status) <> '' ORDER BY c.status ASC`,
      [empresaId]
    );

    const status = rows.map(r => r.status);
    res.json(status);
  } catch (error) {
    console.error('Erro ao buscar opções de status dos clientes:', error);
    res.status(500).json({ error: 'Erro ao buscar opções de status.' });
  }
});

// Rota para aplicar responsável por departamento
router.post('/:clienteId/responsaveis-departamento', autenticarToken, clienteController.aplicarResponsavelDepartamento);

// Rota para buscar particularidades do cliente
router.get('/:id/particularidades', autenticarToken, clienteController.buscarParticularidadesCliente);

// Rota para replicar perfil do cliente
router.post('/replicar-perfil', autenticarToken, clienteController.replicarPerfilCliente);

// Rota para buscar clientes vinculados aos usuários selecionados
router.get('/usuarios-vinculados', autenticarToken, verificarPermissao('clientes.visualizar'), async (req, res) => {
  try {
    const { usuarioIds, empresaId, grupoId } = req.query;
    
    if (!usuarioIds || !empresaId) {
      return res.status(400).json({ 
        error: "IDs dos usuários e ID da empresa são obrigatórios." 
      });
    }

    // Converter string de IDs para array
    const idsArray = usuarioIds.split(',').map(id => id.trim()).filter(Boolean);
    
    if (idsArray.length === 0) {
      return res.status(400).json({ 
        error: "Pelo menos um ID de usuário deve ser fornecido." 
      });
    }

    // ✅ Construir query com filtro opcional por grupo
    let sql = `
      SELECT DISTINCT 
        c.id,
        c.razao_social as nome,
        c.cnpjCpf,
        c.telefone,
        c.email,
        c.cidade,
        c.estado,
        c.status,
        c.dataInicio,
        u.nome as responsavelNome
      FROM clientes c
      INNER JOIN obrigacoes_responsaveis_cliente orc ON c.id = orc.clienteId
      INNER JOIN usuarios u ON orc.usuarioId = u.id
    `;

    let params = [empresaId, ...idsArray];
    let whereClause = `WHERE c.empresaId = ? AND orc.usuarioId IN (${idsArray.map(() => '?').join(',')})`;

    // ✅ Adicionar filtro por grupo se especificado
    if (grupoId) {
      sql += ` INNER JOIN clientes_grupos_vinculo cgv ON c.id = cgv.clienteId`;
      whereClause += ` AND cgv.grupoId = ?`;
      params.push(grupoId);
    }

    sql += ` ${whereClause} ORDER BY c.razao_social as nome ASC`;

    console.log('🔍 Query clientes vinculados:', sql);
    console.log('🔍 Parâmetros:', params);

    const [clientes] = await db.query(sql, params);

    res.json({
      success: true,
      clientes: clientes,
      total: clientes.length,
      usuariosSelecionados: idsArray,
      grupoFiltro: grupoId || null
    });

  } catch (error) {
    console.error('Erro ao buscar clientes vinculados:', error);
    res.status(500).json({ 
      error: "Erro interno do servidor ao buscar clientes vinculados." 
    });
  }
});

// Exportar clientes em Excel
router.get("/exportar-excel", autenticarToken, verificarPermissao('clientes.visualizar'), async (req, res) => {
  try {
    // Copiar lógica da listagem para garantir filtros e joins idênticos
    const {
      empresaId,
      tipoInscricao,
      tipo,
      status,
      dores,
      solucoes,
      grupos,
      search
    } = req.query;
    if (!empresaId) return res.status(400).json({ error: "Empresa ID é obrigatório." });

    // 🔍 VERIFICAÇÃO DE DUPLICATAS ANTES DE EXPORTAR
    // Verificar se há clientes duplicados por CNPJ/CPF ou nome na empresa
    const [duplicatasCnpj] = await db.query(
      `SELECT cnpjCpf, COUNT(*) as total 
       FROM clientes 
       WHERE empresaId = ? AND cnpjCpf IS NOT NULL AND cnpjCpf != '' 
       GROUP BY cnpjCpf 
       HAVING COUNT(*) > 1`,
      [empresaId]
    );

    const [duplicatasNome] = await db.query(
      `SELECT nome, COUNT(*) as total 
       FROM clientes 
       WHERE empresaId = ? AND nome IS NOT NULL AND nome != '' 
       GROUP BY nome 
       HAVING COUNT(*) > 1`,
      [empresaId]
    );

    // Se encontrou duplicatas, retorna aviso
    if (duplicatasCnpj.length > 0 || duplicatasNome.length > 0) {
      return res.status(409).json({
        error: "Clientes duplicados encontrados",
        duplicatas: {
          cnpjCpf: duplicatasCnpj,
          nome: duplicatasNome
        },
        message: "Existem clientes duplicados na empresa. Resolva as duplicatas antes de exportar."
      });
    }

    let whereClause = "WHERE c.empresaId = ?";
    if (tipoInscricao) whereClause += " AND c.tipoInscricao = ?";
    if (tipo) whereClause += " AND c.tipo = ?";
    if (status) whereClause += " AND c.status = ?";
    if (search) whereClause += " AND (c.razao_social as nome LIKE ? OR c.cnpjCpf LIKE ?)";

    // Filtro por dores
    let joinDores = "";
    let doresArr = [];
    if (dores && typeof dores === 'string' && dores.trim() !== '') {
      doresArr = String(dores).split(",").map(s => s.trim()).filter(Boolean);
      if (doresArr.length > 0) {
        joinDores = ` INNER JOIN clientes_dores cd ON c.id = cd.cliente_id AND cd.dor IN (${doresArr.map(() => "?").join(",")})`;
      }
    }
    // Filtro por solucoes
    let joinSolucoes = "";
    let solucoesArr = [];
    if (solucoes) {
      solucoesArr = String(solucoes).split(",").map(s => s.trim()).filter(Boolean);
      if (solucoesArr.length > 0) {
        joinSolucoes = ` INNER JOIN clientes_solucoes cs ON c.id = cs.cliente_id AND cs.solucao IN (${solucoesArr.map(() => "?").join(",")})`;
      }
    }

    // Filtro por grupos
    let joinGrupos = "";
    if (grupos && typeof grupos === 'string' && grupos.trim() !== '') {
      const gruposArr = String(grupos).split(",").map(s => s.trim()).filter(Boolean);
      if (gruposArr.length > 0) {
        joinGrupos = ` INNER JOIN clientes_grupos_vinculo cgv ON c.id = cgv.clienteId INNER JOIN clientes_grupos cg ON cgv.grupoId = cg.id AND cg.id IN (${gruposArr.map(() => "?").join(",")})`;
      }
    }

    // Montar query final concatenando joins corretamente, sempre com espaço
    const sql = `SELECT 
      c.id,
      c.apelido AS nome,
      c.cpf_cnpj AS cnpjCpf,
      c.telefone_comercial AS telefone,
      c.email_principal AS email,
      c.cidade,
      c.estado,
      c.status,
      c.data_inicio AS dataInicio
    FROM clientes c${joinDores ? ' ' + joinDores : ''}${joinSolucoes ? ' ' + joinSolucoes : ''}${joinGrupos ? ' ' + joinGrupos : ''} ${whereClause} GROUP BY c.id ORDER BY nome ASC`;
    // Montar os parâmetros na ordem correta
    let sqlParams = [];
    if (doresArr.length > 0) sqlParams.push(...doresArr);
    if (solucoesArr.length > 0) sqlParams.push(...solucoesArr);
    if (grupos && typeof grupos === 'string' && grupos.trim() !== '') {
      const gruposArr = String(grupos).split(",").map(s => s.trim()).filter(Boolean);
      if (gruposArr.length > 0) sqlParams.push(...gruposArr);
    }
    sqlParams.push(empresaId);
    if (tipoInscricao) sqlParams.push(tipoInscricao);
    if (tipo) sqlParams.push(tipo);
    if (status) sqlParams.push(status);
    if (search) { sqlParams.push(`%${search}%`, `%${search}%`); }

    const [clientes] = await db.query(sql, sqlParams);

    // Buscar dores e solucoes em lote para todos os clientes retornados
    const clienteIds = clientes.map(c => c.id);
    let doresMap = {}, solucoesMap = {};
    if (clienteIds.length > 0) {
      const [doresRows] = await db.query(`SELECT cliente_id, dor FROM clientes_dores WHERE cliente_id IN (${clienteIds.map(() => "?").join(",")})`, clienteIds);
      doresRows.forEach(row => {
        if (!doresMap[row.cliente_id]) doresMap[row.cliente_id] = [];
        doresMap[row.cliente_id].push(row.dor);
      });
      const [solucoesRows] = await db.query(`SELECT cliente_id, solucao FROM clientes_solucoes WHERE cliente_id IN (${clienteIds.map(() => "?").join(",")})`, clienteIds);
      solucoesRows.forEach(row => {
        if (!solucoesMap[row.cliente_id]) solucoesMap[row.cliente_id] = [];
        solucoesMap[row.cliente_id].push(row.solucao);
      });
    }
    // Adiciona dores e solucoes como string separada por vírgula
    clientes.forEach(c => {
      c.dores = (doresMap[c.id] || []).join(", ");
      c.solucoes = (solucoesMap[c.id] || []).join(", ");
    });

    // Monta a planilha
    const ws = require('xlsx').utils.json_to_sheet(clientes);
    const wb = require('xlsx').utils.book_new();
    require('xlsx').utils.book_append_sheet(wb, ws, "Clientes");
    const buffer = require('xlsx').write(wb, { type: "buffer", bookType: "xlsx" });
    res.setHeader("Content-Disposition", "attachment; filename=clientes.xlsx");
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.send(buffer);
  } catch (error) {
    console.error("Erro ao exportar clientes:", error);
    res.status(500).json({ error: "Erro ao exportar clientes." });
  }
});


//GRUPOS 

// GET /api/clientes/grupos/todos?empresaId=123
router.get("/grupos/todos", async (req, res) => {
  const empresaId = req.query.empresaId || req.empresaId;
  if (!empresaId) return res.status(400).json({ error: "empresaId é obrigatório." });

  try {
    const [grupos] = await db.query(
      "SELECT id, nome FROM clientes_grupos WHERE empresa_id = ? ORDER BY nome ASC",
      [empresaId]
    );
    res.json({ grupos });
  } catch (err) {
    res.status(500).json({ error: "Erro ao listar grupos." });
  }
});


router.get("/grupo/:grupoId", async (req, res) => {
  const { grupoId } = req.params;
  try {
    const [clientes] = await db.query(
      `SELECT c.id, c.razao_social as nome, c.cnpjCpf
         FROM clientes c
         JOIN clientes_grupos_vinculo cgv ON c.id = cgv.clienteId
        WHERE cgv.grupoId = ?`,
      [grupoId]
    );
    res.json({ clientes });
  } catch (err) {
    res.status(500).json({ error: "Erro ao buscar clientes do grupo." });
  }
});

// 1. Criar grupo de cliente
router.post("/grupos", async (req, res) => {
  const { nome, empresaId } = req.body;
  if (!nome || !empresaId) return res.status(400).json({ error: "Nome e empresaId são obrigatórios." });

  try {
    const [existentes] = await db.query(
      "SELECT id FROM clientes_grupos WHERE nome = ? AND empresaId = ?",
      [nome, empresaId]
    );
    if (existentes.length > 0) {
      return res.status(409).json({ error: "Já existe um grupo com esse nome." });
    }
    const [r] = await db.query(
      "INSERT INTO clientes_grupos (empresaId, nome) VALUES (?, ?)",
      [empresaId, nome]
    );
    res.status(201).json({ success: true, grupoId: r.insertId });
  } catch (err) {
    res.status(500).json({ error: "Erro ao criar grupo." });
  }
});

// Excluir grupo de cliente (por ID)
router.delete("/grupos/:id", async (req, res) => {
  const { id } = req.params;

  try {
    // Remove os vínculos primeiro (caso existam)
    await db.query("DELETE FROM clientes_grupos_vinculo WHERE grupoId = ?", [id]);
    // Depois remove o grupo em si
    const [resultado] = await db.query(
      "DELETE FROM clientes_grupos WHERE id = ?", [id]
    );
    if (resultado.affectedRows === 0) {
      return res.status(404).json({ error: "Grupo não encontrado." });
    }
    res.json({ success: true, message: "Grupo excluído com sucesso!" });
  } catch (err) {
    res.status(500).json({ error: "Erro ao excluir grupo." });
  }
});

// GET /api/clientes/grupos/:id - Buscar grupo específico
router.get("/grupos/:id", async (req, res) => {
  const { id } = req.params;
  const empresaId = req.query.empresaId || req.empresaId;
  
  if (!empresaId) return res.status(400).json({ error: "empresaId é obrigatório." });

  try {
    const [grupos] = await db.query(
      "SELECT id, nome, empresaId FROM clientes_grupos WHERE id = ? AND empresaId = ?",
      [id, empresaId]
    );
    
    if (grupos.length === 0) {
      return res.status(404).json({ error: "Grupo não encontrado." });
    }
    
    res.json(grupos[0]);
  } catch (err) {
    console.error("Erro ao buscar grupo:", err);
    res.status(500).json({ error: "Erro ao buscar grupo." });
  }
});

// 2. Listar grupos
router.get("/grupos", async (req, res) => {
  const empresaId = req.query.empresaId || req.empresaId;
  if (!empresaId) return res.status(400).json({ error: "empresaId é obrigatório." });

  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const offset = (page - 1) * limit;
  const search = (req.query.search || "").trim();

  try {
    let where = "WHERE empresaId = ?";
    let params = [empresaId];

    if (search) {
      where += " AND nome LIKE ?";
      params.push(`%${search}%`);
    }

    // Sempre aplicar paginação, independente de ter busca ou não
    const [grupos] = await db.query(
      `SELECT * FROM clientes_grupos ${where} ORDER BY nome ASC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    const [countRows] = await db.query(
      `SELECT COUNT(*) as total FROM clientes_grupos ${where}`,
      params
    );
    const total = countRows[0]?.total || 0;

    res.json({ grupos, total });
  } catch (err) {
    res.status(500).json({ error: "Erro ao listar grupos." });
  }
});

// 3. Vincular grupos ao cliente (substitui vínculos antigos)
router.post("/vincular-grupos", async (req, res) => {
  const { clienteId, grupoIds } = req.body;
  if (!clienteId || !Array.isArray(grupoIds)) return res.status(400).json({ error: "clienteId e grupoIds obrigatórios." });

  try {
    // Remove vínculos antigos
    await db.query("DELETE FROM clientes_grupos_vinculo WHERE clienteId = ?", [clienteId]);
    if (grupoIds.length > 0) {
      const values = grupoIds.map(grupoId => [clienteId, grupoId]);
      await db.query("INSERT INTO clientes_grupos_vinculo (clienteId, grupoId) VALUES ?", [values]);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Erro ao vincular grupos ao cliente." });
  }
});

// 4. Listar grupos de um cliente
router.get("/:clienteId/grupos", async (req, res) => {
  const { clienteId } = req.params;
  try {
    const [grupos] = await db.query(
      `SELECT cg.id, cg.nome
       FROM clientes_grupos_vinculo cgv
       JOIN clientes_grupos cg ON cgv.grupoId = cg.id
       WHERE cgv.clienteId = ?`, [clienteId]
    );
    res.json(grupos);
  } catch (err) {
    res.status(500).json({ error: "Erro ao buscar grupos do cliente." });
  }
});

// 5. Adicionar clientes a um grupo específico
router.post("/grupos/:grupoId/clientes", async (req, res) => {
  const { grupoId } = req.params;
  const { clienteIds } = req.body;
  
  if (!Array.isArray(clienteIds) || clienteIds.length === 0) {
    return res.status(400).json({ error: "clienteIds é obrigatório e deve ser um array não vazio." });
  }

  try {
    // Verificar se o grupo existe
    const [grupo] = await db.query("SELECT id FROM clientes_grupos WHERE id = ?", [grupoId]);
    if (grupo.length === 0) {
      return res.status(404).json({ error: "Grupo não encontrado." });
    }

    // Adicionar cada cliente ao grupo (ignorar duplicatas)
    let adicionados = 0;
    for (const clienteId of clienteIds) {
      try {
        await db.query(
          "INSERT IGNORE INTO clientes_grupos_vinculo (clienteId, grupoId) VALUES (?, ?)",
          [clienteId, grupoId]
        );
        adicionados++;
      } catch (err) {
        // Ignorar erros de duplicata
        console.log(`Cliente ${clienteId} já está no grupo ${grupoId}`);
      }
    }

    res.json({ 
      success: true, 
      message: `${adicionados} cliente(s) adicionado(s) ao grupo com sucesso!`,
      adicionados 
    });
  } catch (err) {
    console.error("Erro ao adicionar clientes ao grupo:", err);
    res.status(500).json({ error: "Erro ao adicionar clientes ao grupo." });
  }
});

// Atualizar nome do grupo
router.patch("/grupos/:id", async (req, res) => {
  const { id } = req.params;
  const { nome, empresaId } = req.body;

  if (!nome) return res.status(400).json({ error: "Nome é obrigatório." });

  try {
    // Verifica se já existe grupo com esse nome na mesma empresa (evita duplicidade)
    if (empresaId) {
      const [existentes] = await db.query(
        "SELECT id FROM clientes_grupos WHERE nome = ? AND empresaId = ? AND id <> ?",
        [nome, empresaId, id]
      );
      if (existentes.length > 0) {
        return res.status(409).json({ error: "Já existe um grupo com esse nome." });
      }
    }

    const [resultado] = await db.query(
      "UPDATE clientes_grupos SET nome = ? WHERE id = ?",
      [nome, id]
    );
    if (resultado.affectedRows === 0) {
      return res.status(404).json({ error: "Grupo não encontrado." });
    }
    res.json({ success: true, message: "Grupo atualizado com sucesso!" });
  } catch (err) {
    res.status(500).json({ error: "Erro ao atualizar grupo." });
  }
});


// CLIENTES

// 📌 Rota para cadastrar um novo cliente e já processar tudo
router.post("/cadastrar", autenticarToken, verificarPermissao('clientes.criar'), async (req, res) => {
  try {
    const { empresaId, nome, cnpjCpf, telefone, email, endereco, sistema, base, codigo } = req.body;

    // Atualize o nome para ser apelido
    const apelido = nome;

    if (!empresaId || !apelido) {
      return res.status(400).json({ error: "Campos obrigatórios: empresaId, apelido." });
    }

    // 1️⃣ Inserir o novo cliente no banco, mapeando nome para apelido
    const [resultado] = await db.query(
      `INSERT INTO clientes (empresaId, apelido, cnpjCpf, telefone, email, endereco, sistema, base, codigo)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [empresaId, apelido, cnpjCpf, telefone || null, email || null, endereco || null, sistema || null, base || null, codigo || null]
    );

    const novoClienteId = resultado.insertId;

    // 2️⃣ Processar Situação Fiscal
    try {
      await processarSituacaoFiscalCliente(novoClienteId, empresaId, cnpjCpf);
    } catch (erroSitFis) {
      console.warn(`⚠️ Falha ao processar Situação Fiscal do cliente ${novoClienteId}:`, erroSitFis.message);
    }

    res.status(201).json({ success: true, clienteId: novoClienteId, message: "Cliente cadastrado e processado com sucesso!" });
  } catch (error) {
    console.error("❌ Erro ao cadastrar cliente:", error);
    res.status(500).json({ error: "Erro ao cadastrar cliente." });
  }
});


// Função para formatar a data no formato 'YYYY-MM-DD'
const formatDate = (date) => {
  if (!date) return null; // Se a data for nula, retorna nula
  return new Date(date).toISOString().split('T')[0]; // Formata a data
};

router.post("/cadastrar/individual", async (req, res) => {
  try {
    const {
      empresaId,
      tipoInscricao,
      cnpjCpf,
      nome,
      apelido,
      tipo,
      sistema,
      base,
      codigo,
      status,
      statusComplementar,
      dataInicio,
      dataFim,
      dataNascimento,
      telefone,
      email,
      responsavelLegal,
      regimeTributario,
      endereco,
      rua,
      complemento,
      bairro,
      cidade,
      estado,
      cep,
      pais,
      observacao,
      grupoIds, // <-- AQUI!
      dores,
      solucoes
    } = req.body;

    if (!empresaId || !nome) {
      return res.status(400).json({ error: "Campos obrigatórios: empresaId e nome." });
    }

    // 🔍 VERIFICAÇÃO DE DUPLICATAS
    let duplicataEncontrada = null;
    
    // Verificar por CNPJ/CPF se fornecido
    if (cnpjCpf && cnpjCpf.trim()) {
      const [existeCnpj] = await db.query(
        "SELECT id, nome, cnpjCpf FROM clientes WHERE cnpjCpf = ? AND empresaId = ?",
        [cnpjCpf.trim(), empresaId]
      );
      if (existeCnpj.length > 0) {
        duplicataEncontrada = {
          tipo: "CNPJ/CPF",
          valor: cnpjCpf.trim(),
          clienteExistente: existeCnpj[0]
        };
      }
    }
    
    // Verificar por nome se não encontrou duplicata por CNPJ/CPF
    if (!duplicataEncontrada && nome && nome.trim()) {
      const [existeNome] = await db.query(
        "SELECT id, nome, cnpjCpf FROM clientes WHERE LOWER(TRIM(nome)) = LOWER(TRIM(?)) AND empresaId = ?",
        [nome.trim(), empresaId]
      );
      if (existeNome.length > 0) {
        duplicataEncontrada = {
          tipo: "nome",
          valor: nome.trim(),
          clienteExistente: existeNome[0]
        };
      }
    }

    // Se encontrou duplicata, retorna erro
    if (duplicataEncontrada) {
      return res.status(409).json({
        error: "Cliente duplicado",
        duplicata: duplicataEncontrada,
        message: `Já existe um cliente com ${duplicataEncontrada.tipo === 'CNPJ/CPF' ? 'este CNPJ/CPF' : 'este nome'} na empresa.`
      });
    }

    const [resultado] = await db.query(
      `INSERT INTO clientes (
        empresaId, tipoInscricao, cnpjCpf, nome, apelido, tipo, sistema, base, codigo,
        status, statusComplementar, dataInicio, dataFim, dataNascimento,
        telefone, email, responsavelLegal, regimeTributario, endereco,
        rua, complemento, bairro, cidade, estado, cep, pais, observacao
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        empresaId, tipoInscricao || null, cnpjCpf, nome, apelido || null,
        tipo || "Fixo", sistema || null, base || null, codigo || null, status || "Ativo",
        statusComplementar || null, formatDate(dataInicio) || null, formatDate(dataFim) || null, formatDate(dataNascimento) || null,
        telefone || null, email || null, responsavelLegal || null,
        regimeTributario || null, endereco || null,
        rua || null, complemento || null, bairro || null, cidade || null, estado || null, cep || null, pais || null, observacao || null
      ]
    );

    const clienteId = resultado.insertId;

    // Salva os vínculos de grupo, SE houver grupoIds (array)
    if (Array.isArray(grupoIds) && grupoIds.length > 0) {
      const values = grupoIds.map(grupoId => [clienteId, grupoId]);
      await db.query("INSERT INTO clientes_grupos_vinculo (clienteId, grupoId) VALUES ?", [values]);
    }

    // Salva dores e soluções, se enviados
    if (Array.isArray(dores) && dores.length > 0) {
      for (const dor of dores) {
        await db.query('INSERT INTO clientes_dores (cliente_id, dor) VALUES (?, ?)', [clienteId, dor]);
      }
    }
    if (Array.isArray(solucoes) && solucoes.length > 0) {
      for (const solucao of solucoes) {
        await db.query('INSERT INTO clientes_solucoes (cliente_id, solucao) VALUES (?, ?)', [clienteId, solucao]);
      }
    }

    res.status(201).json({ clienteId });
  } catch (error) {
    console.error("Erro ao cadastrar cliente:", error);
    res.status(500).json({ error: "Erro ao cadastrar cliente." });
  }
});




/**
 * 📌 Rota para importar clientes do Eplugin e salvar no banco
 */
router.post("/importar", async (req, res) => {
    try {
        const { empresaId, usuarioId } = req.body;

        // Verifica se os campos obrigatórios estão presentes
        if (!empresaId || !usuarioId) {
            return res.status(400).json({ error: "ID da empresa e ID do usuário são obrigatórios." });
        }

        // 🔹 Importa os clientes e vincula corretamente no BD
        await importarEmpresasParaBD(empresaId, usuarioId);

        // 🔹 Garante que o usuário tem acesso à empresa
        const [relacaoExistente] = await db.query(
            "SELECT id FROM relacao_empresas WHERE empresaId = ? AND usuarioId = ?",
            [empresaId, usuarioId]
        );

        // Se a relação entre usuário e empresa não existe, cria uma nova
        if (!relacaoExistente.length) {
            await db.query(
                "INSERT INTO relacao_empresas (empresaId, usuarioId) VALUES (?, ?)",
                [empresaId, usuarioId]
            );

        }

        // 🔹 Busca os clientes recém-importados
        const [clientes] = await db.query(
            "SELECT id, cnpjCpf, nome FROM clientes WHERE empresaId = ?",
            [empresaId]
        );

        // 🔹 Processa a situação fiscal de cada cliente
        Promise.all(
            clientes.map(async (cliente) => {
                try {
                    if (!cliente.cnpjCpf) return;

                    // Atualiza o nome para apelido
                    const apelido = cliente.nome;

                    // 🔹 1. Situação Fiscal
                    await processarSituacaoFiscalCliente(cliente.id, empresaId, cliente.cnpjCpf);

                    // 🔹 2. Consultar Regime Tributário
                    try {
                        const tributacao = await consultarTributacaoDetalhada(cliente.cnpjCpf);

                        const [resultadoUpdate] = await db.query(
                            `UPDATE clientes SET apelido = ?, regimeTributario = ? WHERE id = ?`,
                            [apelido, tributacao.regime, cliente.id]
                        );
                        
                    } catch (errTrib) {
                        console.warn(`⚠️ Falha ao consultar tributação do cliente ${cliente.id}:`, errTrib.message);
                    }

                    // 🔹 3. Consultar DCTF Web
                    try {
                        const categoria = "40";
                        const hoje = new Date();
                        const anoPA = hoje.getFullYear().toString();
                        const mesPA = (hoje.getMonth() + 1).toString().padStart(2, "0");

                        const xmlBase64 = await consultarDCTFWeb(empresaId, cliente.id, categoria, anoPA, mesPA);

                        await db.execute(
                            `INSERT INTO dctfweb (empresa_id, cliente_id, competencia, data_criacao, xml_base64, status)
                             VALUES (?, ?, ?, NOW(), ?, ?)`,

                            [empresaId, cliente.id, `${mesPA}/${anoPA}`, xmlBase64, "Em Andamento"]
                        );

                    } catch (erroDCTF) {
                        console.warn(`⚠️ Falha ao consultar DCTF Web do cliente ${cliente.id}:`, erroDCTF.message);
                    }

                } catch (erroCliente) {
                    console.error(`❌ Erro ao processar cliente ${cliente.id}:`, erroCliente.message);
                }
            })
        ).then(() => {
        });

        // Responde com sucesso
        res.json({ success: true, message: "Clientes importados, situação fiscal e DCTF Web consultadas com sucesso!" });
    } catch (error) {
        console.error("❌ Erro ao importar clientes:", error);
        res.status(500).json({ error: "Erro ao importar clientes." });
    }
});

/**
 * 📌 Rota para listar os clientes
 */
router.get("/", autenticarToken, verificarPermissao('clientes.visualizar'), async (req, res) => {
  try {
    const {
      empresaId,
      page = 1,
      limit = 10,
      tipoInscricao,
      tipo,
      status,
      statusComplementar,
      dores,
      solucoes,
      grupos,
      sortBy,
      sortOrder = 'asc'
    } = req.query;

    if (!empresaId) return res.status(400).json({ error: "Empresa ID é obrigatório." });

    const offset = (page - 1) * limit;
    let whereClause = "WHERE c.empresaId = ?";
    const params = [empresaId];

    if (tipoInscricao) {
      whereClause += " AND c.tipoInscricao = ?";
      params.push(tipoInscricao);
    }

    if (tipo) {
      whereClause += " AND c.tipo = ?";
      params.push(tipo);
    }

    if (status) {
      whereClause += " AND c.status = ?";
      params.push(status);
    }

    if (statusComplementar) {
      whereClause += " AND c.statusComplementar LIKE ?";
      params.push(`%${statusComplementar}%`);
    }

    if (req.query.search) {
      whereClause += " AND (c.razao_social as nome LIKE ? OR c.cnpjCpf LIKE ?)";
      params.push(`%${req.query.search}%`, `%${req.query.search}%`);
    }

    // Filtro por dores
    let joinDores = "";
    if (dores) {
      const doresArr = String(dores).split(",").map(s => s.trim()).filter(Boolean);
      if (doresArr.length > 0) {
        joinDores = ` INNER JOIN clientes_dores cd ON c.id = cd.cliente_id AND cd.dor IN (${doresArr.map(() => "?").join(",")})`;
        params.push(...doresArr);
      }
    }
    // Filtro por solucoes
    let joinSolucoes = "";
    if (solucoes) {
      const solucoesArr = String(solucoes).split(",").map(s => s.trim()).filter(Boolean);
      if (solucoesArr.length > 0) {
        joinSolucoes = ` INNER JOIN clientes_solucoes cs ON c.id = cs.cliente_id AND cs.solucao IN (${solucoesArr.map(() => "?").join(",")})`;
        params.push(...solucoesArr);
      }
    }

    // Filtro por grupos
    let joinGrupos = "";
    if (grupos) {
      const gruposArr = String(grupos).split(",").map(s => s.trim()).filter(Boolean);
      if (gruposArr.length > 0) {
        joinGrupos = ` INNER JOIN clientes_grupos_vinculo cgv ON c.id = cgv.clienteId INNER JOIN clientes_grupos cg ON cgv.grupoId = cg.id AND cg.id IN (${gruposArr.map(() => "?").join(",")})`;
        params.push(...gruposArr);
      }
    }

    // Definir ordenação
    let orderBy = "ORDER BY c.id DESC"; // Ordenação padrão
    if (sortBy) {
      const allowedSortFields = ['nome', 'tipoInscricao', 'status', 'dataInicio', 'id'];
      const allowedSortOrders = ['asc', 'desc'];
      
      if (allowedSortFields.includes(sortBy) && allowedSortOrders.includes(sortOrder.toLowerCase())) {
        orderBy = `ORDER BY c.${sortBy} ${sortOrder.toUpperCase()}`;
      }
    }

    const sql = `SELECT 
      c.id, c.razao_social as nome, c.cnpjCpf, c.telefone, c.email, c.endereco, c.rua, c.complemento, c.bairro, c.cidade, c.estado, c.cep, c.pais,
      c.dataCriacao, c.dataFim, c.dataNascimento, c.observacao,
      c.regimeTributario, c.tipoInscricao, c.apelido, c.sistema,
      c.tipo, c.status, c.statusComplementar, c.responsavelLegal, c.dataInicio
      FROM clientes c
      ${joinDores}
      ${joinSolucoes}
      ${joinGrupos}
      ${whereClause}
      GROUP BY c.id
      ${orderBy}
      LIMIT ? OFFSET ?`;
    // Montagem correta dos parâmetros na ordem dos ? da query
    let sqlParams = [];
    // Adiciona dores e solucoes (caso existam JOINs)
    if (dores) {
      const doresArr = String(dores).split(",").map(s => s.trim()).filter(Boolean);
      if (doresArr.length > 0) sqlParams.push(...doresArr);
    }
    if (solucoes) {
      const solucoesArr = String(solucoes).split(",").map(s => s.trim()).filter(Boolean);
      if (solucoesArr.length > 0) sqlParams.push(...solucoesArr);
    }
    if (grupos) {
      const gruposArr = String(grupos).split(",").map(s => s.trim()).filter(Boolean);
      if (gruposArr.length > 0) sqlParams.push(...gruposArr);
    }
    // Adiciona empresaId
    sqlParams.push(empresaId);
    // Adiciona os parâmetros do whereClause (exceto dores/solucoes/empresaId, que já foram adicionados)
    // Busca todos os filtros usados no whereClause
    if (tipoInscricao) sqlParams.push(tipoInscricao);
    if (tipo) sqlParams.push(tipo);
    if (status) sqlParams.push(status);
    if (statusComplementar) sqlParams.push(`%${statusComplementar}%`);
    if (req.query.search) {
      sqlParams.push(`%${req.query.search}%`, `%${req.query.search}%`);
    }
    // Adiciona LIMIT e OFFSET
    sqlParams.push(parseInt(limit), parseInt(offset));

    const [clientes] = await db.query(sql, sqlParams);

    // Busca dores e solucoes em lote para todos os clientes retornados
    const clienteIds = clientes.map(c => c.id);
    let doresMap = {}, solucoesMap = {};
    if (clienteIds.length > 0) {
      // Dores
      const [doresRows] = await db.query(`SELECT cliente_id, dor FROM clientes_dores WHERE cliente_id IN (${clienteIds.map(() => "?").join(",")})`, clienteIds);
      doresRows.forEach(row => {
        if (!doresMap[row.cliente_id]) doresMap[row.cliente_id] = [];
        doresMap[row.cliente_id].push(row.dor);
      });
      // Soluções
      const [solucoesRows] = await db.query(`SELECT cliente_id, solucao FROM clientes_solucoes WHERE cliente_id IN (${clienteIds.map(() => "?").join(",")})`, clienteIds);
      solucoesRows.forEach(row => {
        if (!solucoesMap[row.cliente_id]) solucoesMap[row.cliente_id] = [];
        solucoesMap[row.cliente_id].push(row.solucao);
      });
    }
    // Adiciona dores e solucoes a cada cliente
    clientes.forEach(c => {
      c.dores = doresMap[c.id] || [];
      c.solucoes = solucoesMap[c.id] || [];
    });

    // Contagem total
    const countSql = `SELECT COUNT(DISTINCT c.id) as total FROM clientes c ${joinDores} ${joinSolucoes} ${joinGrupos} ${whereClause}`;
    const [countRows] = await db.query(countSql, params);
    const total = countRows[0]?.total || 0;

    res.json({ clientes, total });
  } catch (error) {
    console.error("❌ Erro ao listar clientes:", error);
    res.status(500).json({ error: "Erro ao listar clientes." });
  }
});


router.get("/teste/tributacao/:empresaId", async (req, res) => {
    const { empresaId } = req.params;
  
    try {
      const [clientes] = await db.query(
        "SELECT id, nome, cnpjCpf FROM clientes WHERE empresaId = ? AND LENGTH(cnpjCpf) = 14",
        [empresaId]
      );
  
      const resultados = [];
  
      for (const cliente of clientes) {
        try {
          const tributacao = await consultarTributacaoDetalhada(cliente.cnpjCpf);
  
          // Atualiza o regime no banco
          const [resultadoUpdate] = await db.query(
            `UPDATE clientes SET regimeTributario = ? WHERE id = ?`,
            [tributacao.regime, cliente.id]
          );
  
        } catch (err) {
          console.warn(`⚠️ Falha ao consultar tributação do cliente ${cliente.id}:`, err.message);
          resultados.push({
            id: cliente.id,
            nome: cliente.nome,
            cnpj: cliente.cnpjCpf,
            erro: err.message
          });
        }
      }
  
      res.json({ empresaId, resultados });
    } catch (error) {
      console.error("❌ Erro ao consultar tributação dos clientes:", error);
      res.status(500).json({ error: "Erro ao consultar tributação dos clientes." });
    }
  });
  
  // Rota para consultar dados do CNPJ na Receita
router.get("/consultar-cnpj/:cnpj", async (req, res) => {
  const { cnpj } = req.params;

  try {
    if (!cnpj || cnpj.length < 14) return res.status(400).json({ error: "CNPJ inválido." });

    // Exemplo usando API pública (troque para sua API privada se tiver)
    const response = await axios.get(`https://receitaws.com.br/v1/cnpj/${cnpj.replace(/\D/g, '')}`);

    if (response.data.status === "ERROR") return res.status(404).json({ error: response.data.message });

    res.json({
      nome: response.data.nome,
      fantasia: response.data.fantasia,
      telefone: response.data.telefone,
      email: response.data.email,
      endereco: `${response.data.logradouro}, ${response.data.numero} - ${response.data.bairro}`
    });
  } catch (err) {
    console.error("Erro ao consultar Receita:", err);
    res.status(500).json({ error: "Falha na consulta." });
  }
});

  
// Rota para buscar cliente por ID
router.get("/:id", autenticarToken, verificarPermissao('clientes.visualizar'), async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await db.query(
      `SELECT
        id, empresaId, nome, cnpjCpf, telefone, email, endereco, rua, complemento, bairro, cidade, estado, cep, pais,
        dataCriacao, dataFim, dataNascimento, observacao,
        regimeTributario, tipoInscricao, apelido, sistema, base, codigo,
        tipo, status, statusComplementar, responsavelLegal, dataInicio
      FROM clientes WHERE id = ?`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Cliente não encontrado." });
    }

    const cliente = rows[0];

    // Buscar dores e soluções do cliente
    const [doresRows] = await db.query('SELECT dor FROM clientes_dores WHERE cliente_id = ?', [id]);
    const [solucoesRows] = await db.query('SELECT solucao FROM clientes_solucoes WHERE cliente_id = ?', [id]);
    cliente.dores = doresRows.map(r => r.dor);
    cliente.solucoes = solucoesRows.map(r => r.solucao);

    // Formata as datas para o padrão desejado
    cliente.dataInicio = cliente.dataInicio ? cliente.dataInicio.toISOString().split('T')[0] : null;
    cliente.dataFim = cliente.dataFim ? cliente.dataFim.toISOString().split('T')[0] : null;
    cliente.dataNascimento = cliente.dataNascimento ? cliente.dataNascimento.toISOString().split('T')[0] : null;

    res.json(cliente);
  } catch (error) {
    console.error("Erro ao buscar cliente por ID:", error);
    res.status(500).json({ error: "Erro ao buscar cliente." });
  }
});


// 📌 Rota simplificada para listar todos os clientes de uma empresa (sem paginação)
router.get("/todos/:empresaId", async (req, res) => {
  const { empresaId } = req.params;
  const busca = req.query.busca ? String(req.query.busca).trim() : '';

  if (!empresaId) {
    return res.status(400).json({ error: "Empresa ID é obrigatório." });
  }

  let sql = `SELECT id as clienteId, nome, cnpjCpf FROM clientes WHERE empresaId = ?`;
  let params = [empresaId];

  if (busca) {
    // Divide em termos (ex: "3 cepas" => ["3", "cepas"])
    const termos = busca.toLowerCase().split(/\s+/).filter(Boolean);

    // Para cada termo, adiciona um LIKE
    if (termos.length > 0) {
      sql += " AND (";
      // Busca em nome
      sql += termos.map(() => `LOWER(nome) LIKE ?`).join(" AND ");
      // Busca também no CNPJ (opcional, pode manter do jeito antigo se quiser)
      // Se quiser buscar CNPJ pelo termo completo, pode adicionar mais uma OR, mas normalmente só busca por número
      sql += ")";
      // Adiciona os parâmetros para cada termo
      termos.forEach(t => params.push(`%${t}%`));
    }
  }

  sql += " ORDER BY nome ASC";

  try {
    const [clientes] = await db.query(sql, params);
    res.json({ clientes });
  } catch (error) {
    console.error("❌ Erro ao listar todos os clientes:", error);
    res.status(500).json({ error: "Erro ao listar clientes." });
  }
});

// POST /api/clientes/importar-planilha
router.post('/importar-planilha',
  autenticarToken,
  verificarPermissao('clientes.criar'),
  upload.single('file'),
  async (req, res) => {
    try {
      // LOGS DETALHADOS PARA DEBUG
      console.log('==== [IMPORTAÇÃO DE CLIENTES] ====');
      console.log('req.body:', req.body);
      console.log('req.file:', req.file ? req.file.originalname : null);
      if (req.body.colMap) {
        try {
          console.log('colMap recebido:', JSON.parse(req.body.colMap));
        } catch (e) {
          console.log('colMap recebido (não é JSON válido):', req.body.colMap);
        }
      }
      if (!req.file) {
        return res.status(400).json({ error: 'Arquivo não recebido.' });
      }

      // Garante máxima compatibilidade na busca do empresaId
      const empresaId =
        (req.usuario && (req.usuario.empresaId || req.usuario.empresaID || req.usuario.empresa_id)) ||
        req.empresaId ||
        req.body.empresaId || req.body.empresaID || req.body.empresa_id ||
        req.query.empresaId || req.query.empresaID || req.query.empresa_id;

      if (!empresaId) {
        return res.status(400).json({ error: 'empresaId não fornecido no token, no body ou na query.' });
      }

      const arquivo = req.file.path;

      const wb = xlsx.readFile(arquivo);
      const nomesPlanilhas = wb.SheetNames;

      const planilha = wb.Sheets[nomesPlanilhas[0]];
      const dados = xlsx.utils.sheet_to_json(planilha, { defval: '' });

      if (!dados.length) {
        fs.unlinkSync(arquivo);
        return res.status(400).json({ error: 'Planilha vazia ou não reconhecida.' });
      }

      // Correção: definir rawKeys antes de usar
      const rawKeys = Object.keys(dados[0] || {});
      const keyMap = {};
      rawKeys.forEach(orig => {
        keyMap[orig.trim().toLowerCase()] = orig;
      });

      function getField(linha, key) {
        return linha[keyMap[key]] ?? null;
      }

      // Função utilitária para buscar o valor de múltiplas chaves possíveis
      function getFieldMulti(linha, keys) {
        for (const key of keys) {
          const val = getField(linha, key);
          if (val) return val;
        }
        return null;
      }

      // --- NOVO: Mapeamento dinâmico usando colMap ---
      let colMap = null;
      if (req.body.colMap) {
        try {
          colMap = JSON.parse(req.body.colMap);
        } catch (e) {
          colMap = null;
        }
      }

      let inseridos = 0;
      let atualizados = 0;
      let pulados = 0;
      let gruposCriados = 0;
      let gruposVinculados = 0;

      // Utilitário: normaliza datas para yyyy-mm-dd (suporta dd/mm/yyyy, Date e serial Excel)
      function normalizarDataParaISO(valor) {
        if (!valor && valor !== 0) return null;
        // Date
        if (valor instanceof Date && !isNaN(valor)) {
          return valor.toISOString().slice(0, 10);
        }
        // Número (serial Excel)
        if (typeof valor === 'number' || (typeof valor === 'string' && /^\d+$/.test(valor))) {
          const num = Number(valor);
          if (!isNaN(num) && num > 25000 && num < 60000) {
            const base = new Date(Date.UTC(1899, 11, 30));
            const date = new Date(base.getTime() + num * 24 * 60 * 60 * 1000);
            return date.toISOString().slice(0, 10);
          }
        }
        // String dd/mm/yyyy
        if (typeof valor === 'string') {
          const s = valor.trim();
          const mBR = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
          if (mBR) {
            const [_, d, m, y] = mBR;
            return `${y}-${m}-${d}`;
          }
          // yyyy-mm-dd (já ok)
          if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
        }
        return null;
      }

      for (let idx = 0; idx < dados.length; idx++) {
        const linha = dados[idx];
        let nome, apelido, cnpjCpf, regimeTributario, grupoNome, email;
        // novos campos
        let telefone = null;
        let cep = null;
        let dataInicio = null;
        let tipoInscricao = null;
        let codigo = null;
        // campos de endereço
        let endereco = null;
        let bairro = null;
        let cidade = null;
        let estado = null;
        
        // Log para debug - mostrar as chaves disponíveis na primeira linha
        if (idx === 0) {
          console.log('🔍 Campos disponíveis na planilha:', Object.keys(linha));
          console.log('🔍 Primeira linha de dados:', linha);
        }
        // Se colMap foi enviado, usar ele para mapear os campos
        if (colMap) {
          // Função utilitária para pegar valor da coluna (case insensitive)
          const getCol = (col) => {
            const key = Object.keys(linha).find(k => k.trim().toLowerCase() === col.trim().toLowerCase());
            return key ? linha[key] : null;
          };
          
          // Mapeamento específico para os campos da planilha
          const mapeamento = {
            'EMPRESAS': 'nome',
            'CODIGO': 'codigo',
            'CNPJ/CPF': 'cnpjCpf', 
            'TRIBUTAÇÃO': 'regimeTributario',
            'TELEFONE': 'telefone',
            'EMAIL': 'email',
            'CEP': 'cep',
            'DATAINICIO': 'dataInicio',
            'TIPOINSCRICAO': 'tipoInscricao',
            'ENDERECO': 'endereco',
            'BAIRRO': 'bairro',
            'CIDADE': 'cidade',
            'ESTADO': 'estado'
          };
          
          // Aplicar mapeamento baseado na posição das colunas
          const colunas = Object.keys(linha);
          if (colunas.length >= 3) {
            // Mapear por posição: primeira coluna = nome, segunda = cnpj, terceira = tributação
            nome = linha[colunas[0]] || null;
            cnpjCpf = linha[colunas[1]] ? String(linha[colunas[1]]).replace(/\D/g, '') : null;
            regimeTributario = linha[colunas[2]] || null;
          }
          
          // Também tentar mapeamento por nome de coluna (com base no colMap fornecido)
          for (const [colExcel, destino] of Object.entries(colMap)) {
            const valor = getCol(colExcel);
            if (valor !== null && valor !== undefined) {
              if (Array.isArray(destino)) {
                destino.forEach(d => {
                  if (d === 'nome') nome = valor;
                  if (d === 'apelido') apelido = valor;
                });
              } else {
                if (destino === 'cnpjCpf') cnpjCpf = valor ? String(valor).replace(/\D/g, '') : null;
                if (destino === 'regimeTributario') regimeTributario = valor;
                if (destino === 'grupo') grupoNome = valor;
                if (destino === 'email') email = valor;
                if (destino === 'telefone') telefone = valor;
                if (destino === 'cep') cep = valor ? String(valor) : null;
                if (destino === 'dataInicio') dataInicio = valor ? String(valor) : null;
                if (destino === 'tipoInscricao') tipoInscricao = valor ? String(valor).toUpperCase() : null;
                if (destino === 'codigo') codigo = valor ? String(valor) : null;
                if (destino === 'endereco') endereco = valor;
                if (destino === 'bairro') bairro = valor;
                if (destino === 'cidade') cidade = valor;
                if (destino === 'estado') estado = valor;
                if (destino === 'nome') nome = valor;
              }
            }
          }

          // Fallback: mesmo sem mapeamento explícito em colMap, tentar ler pelos cabeçalhos padrão
          if (email == null) email = getCol('EMAIL');
          if (telefone == null) telefone = getCol('TELEFONE');
          if (cep == null) cep = getCol('CEP');
          if (dataInicio == null) dataInicio = getCol('DATAINICIO');
          if (tipoInscricao == null) tipoInscricao = getCol('TIPOINSCRICAO');
          if (codigo == null) codigo = getCol('CODIGO');
          if (endereco == null) endereco = getCol('ENDERECO');
          if (bairro == null) bairro = getCol('BAIRRO');
          if (cidade == null) cidade = getCol('CIDADE');
          if (estado == null) estado = getCol('ESTADO');
          // Normalizar a data
          if (dataInicio) dataInicio = normalizarDataParaISO(dataInicio);
        } else {
          // Comportamento antigo + novos campos
          nome = getFieldMulti(linha, ['razão social', 'razao social', 'empresas', 'nome empresarial']);
          apelido = nome;
          const cnpjCpfRaw = getFieldMulti(linha, ['cnpj', 'cnpj/caepf', 'número', 'numero']);
          cnpjCpf = cnpjCpfRaw ? String(cnpjCpfRaw).replace(/\D/g, '') : null;
          regimeTributario = getFieldMulti(linha, ['regime tributário', 'regime tributario', 'tributação', 'regime tributario']) || null;
          email = getFieldMulti(linha, ['e-mail', 'email']) || null;
          telefone = getFieldMulti(linha, ['telefone']) || null;
          cep = getFieldMulti(linha, ['cep']) || null;
          dataInicio = getFieldMulti(linha, ['datainicio', 'data inicio']) || null;
          tipoInscricao = getFieldMulti(linha, ['tipoinscricao']) || null;
          codigo = getFieldMulti(linha, ['codigo']) || null;
          endereco = getFieldMulti(linha, ['endereco', 'rua', 'logradouro']) || null;
          bairro = getFieldMulti(linha, ['bairro']) || null;
          cidade = getFieldMulti(linha, ['cidade', 'localidade']) || null;
          estado = getFieldMulti(linha, ['estado', 'uf']) || null;
          if (dataInicio) dataInicio = normalizarDataParaISO(dataInicio);
          grupoNome = getField(linha, 'franquia backoffice') ? String(getField(linha, 'franquia backoffice')).trim() : null;
        }

        // Debug: mostrar valores extraídos
        if (idx === 0) {
          console.log('🔍 Valores extraídos da primeira linha:');
          console.log('  nome:', nome);
          console.log('  cnpjCpf:', cnpjCpf);
          console.log('  regimeTributario:', regimeTributario);
          console.log('  email:', email);
          console.log('  colunas disponíveis:', Object.keys(linha));
          console.log('  valores das colunas:', Object.values(linha));
        }
        
        // Detectar tipoInscricao automaticamente quando não informado
        if (!tipoInscricao && cnpjCpf) {
          if (cnpjCpf.length === 14) tipoInscricao = 'CNPJ';
          else if (cnpjCpf.length === 11) tipoInscricao = 'CPF';
        }

        // Enriquecimento por CNPJ (quando válido e faltam dados)
        if (cnpjCpf && cnpjCpf.length === 14) {
          try {
            if ((!telefone || !cep) && cnpjCpf.length === 14) {
              const resp = await axios.get(`https://publica.cnpj.ws/cnpj/${cnpjCpf}`);
              const est = resp?.data?.estabelecimento;
              if (!telefone && est?.telefone1 && est?.ddd1) {
                telefone = `(${est.ddd1}) ${est.telefone1}`;
              }
              if (!cep && est?.cep) {
                cep = est.cep;
              }
            }
          } catch (e) {
            // silencioso
          }
        }

        // Enriquecimento por CEP (quando válido e faltam dados de endereço)
        if (cep) {
          try {
            const cepLimpo = String(cep).replace(/\D/g, '');
            if (cepLimpo.length === 8) {
              const resp = await axios.get(`https://viacep.com.br/ws/${cepLimpo}/json/`);
              const data = resp.data;
              if (!data.erro) {
                // Preencher campos de endereço se estiverem vazios
                if (!endereco && data.logradouro) endereco = data.logradouro;
                if (!bairro && data.bairro) bairro = data.bairro;
                if (!cidade && data.localidade) cidade = data.localidade;
                if (!estado && data.uf) estado = data.uf;
              }
            }
          } catch (e) {
            // silencioso
          }
        }

        // ... (restante do processamento: inserir/atualizar cliente, criar grupo, vincular grupo, etc)
        if (!nome && !cnpjCpf) {
          pulados++;
          continue;
        }

        // CLIENTE: sempre usar o empresaId do contexto
        let clienteId = null;
        if (cnpjCpf) {
          const [existe] = await db.query('SELECT id FROM clientes WHERE cnpjCpf = ? AND empresaId = ?', [cnpjCpf, empresaId]);
          if (existe.length) clienteId = existe[0].id;
        } else if (nome) {
          const [existe] = await db.query('SELECT id FROM clientes WHERE nome = ? AND empresaId = ?', [nome, empresaId]);
          if (existe.length) clienteId = existe[0].id;
        }

        if (clienteId) {
          await db.query(
            `UPDATE clientes 
              SET nome = ?, apelido = ?, cnpjCpf = ?, regimeTributario = ?, email = ?, telefone = ?, cep = ?, dataInicio = ?, tipoInscricao = ?, codigo = ?, endereco = ?, bairro = ?, cidade = ?, estado = ?
              WHERE id = ?`,
            [nome, apelido, cnpjCpf, regimeTributario, email, telefone, cep, (dataInicio || null), tipoInscricao, codigo, endereco, bairro, cidade, estado, clienteId]
          );
          atualizados++;
        } else {
          const [result] = await db.query(
            `INSERT INTO clientes 
              (empresaId, nome, apelido, cnpjCpf, regimeTributario, email, telefone, cep, dataInicio, tipoInscricao, codigo, endereco, bairro, cidade, estado)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              empresaId,
              nome,
              apelido,
              cnpjCpf,
              regimeTributario,
              email,
              telefone,
              cep,
              dataInicio || null,
              tipoInscricao,
              codigo,
              endereco,
              bairro,
              cidade,
              estado
            ]
          );
          clienteId = result.insertId;
          inseridos++;
        }

        // --- GRUPO (Unid CF) ---
        if (grupoNome) {
          let grupoId = null;
          const [grupoExiste] = await db.query(
            'SELECT id FROM clientes_grupos WHERE nome = ? AND empresaId = ?',
            [grupoNome, empresaId]
          );
          if (grupoExiste.length) {
            grupoId = grupoExiste[0].id;
          } else {
            const [g] = await db.query(
              'INSERT INTO clientes_grupos (empresaId, nome) VALUES (?, ?)',
              [empresaId, grupoNome]
            );
            grupoId = g.insertId;
            gruposCriados++;
          }

          await db.query(
            'DELETE FROM clientes_grupos_vinculo WHERE clienteId = ? AND grupoId = ?',
            [clienteId, grupoId]
          );
          await db.query(
            'INSERT INTO clientes_grupos_vinculo (clienteId, grupoId) VALUES (?, ?)',
            [clienteId, grupoId]
          );
          gruposVinculados++;
        }
      }

      fs.unlinkSync(arquivo);

      res.json({ inseridos, atualizados, pulados, gruposCriados, gruposVinculados });

    } catch (err) {
      console.error('ERRO:', err);
      res.status(500).json({ error: 'Erro ao importar planilha', err: err.message });
    }
  });


// Atualizar cliente pelo ID (PUT /api/clientes/:id)
router.patch("/:id", autenticarToken, verificarPermissao('clientes.editar'), async (req, res) => {
  const { id } = req.params;
  const {
    empresaId,
    tipoInscricao,
    cnpjCpf,
    nome,
    apelido,
    tipo,
    sistema,
    base,
    codigo,
    status,
    statusComplementar,
    dataInicio,
    dataFim,
    dataNascimento,
    telefone,
    email,
    responsavelLegal,
    regimeTributario,
    endereco,
    rua,
    complemento,
    bairro,
    cidade,
    estado,
    cep,
    pais,
    observacao,
    dores,
    solucoes
  } = req.body;

  // Função para formatar as datas no formato YYYY-MM-DD
  const formatDate = (date) => {
    if (!date) return null; // Se a data for nula, retorna nula
    return new Date(date).toISOString().split('T')[0]; // Formata a data
  };

  try {
    const [resultado] = await db.query(
      `UPDATE clientes SET 
        tipoInscricao = ?, cnpjCpf = ?, nome = ?, apelido = ?, tipo = ?, sistema = ?, base = ?, codigo = ?,
        status = ?, statusComplementar = ?, dataInicio = ?, dataFim = ?, dataNascimento = ?,
        telefone = ?, email = ?, responsavelLegal = ?, regimeTributario = ?, endereco = ?,
        rua = ?, complemento = ?, bairro = ?, cidade = ?, estado = ?, cep = ?, pais = ?, observacao = ?
      WHERE id = ?`,
      [
        tipoInscricao || null, cnpjCpf, nome, apelido || null,
        tipo || null, sistema || null, base || null, codigo || null, status || null,
        statusComplementar || null, formatDate(dataInicio) || null, formatDate(dataFim) || null, formatDate(dataNascimento) || null,
        telefone || null, email || null, responsavelLegal || null, regimeTributario || null, endereco || null,
        rua || null, complemento || null, bairro || null, cidade || null, estado || null, cep || null, pais || null, observacao || null,
        id
      ]
    );

    // Atualiza dores e soluções do cliente
    if (Array.isArray(dores)) {
      await db.query('DELETE FROM clientes_dores WHERE cliente_id = ?', [id]);
      for (const dor of dores) {
        await db.query('INSERT INTO clientes_dores (cliente_id, dor) VALUES (?, ?)', [id, dor]);
      }
    }
    if (Array.isArray(solucoes)) {
      await db.query('DELETE FROM clientes_solucoes WHERE cliente_id = ?', [id]);
      for (const solucao of solucoes) {
        await db.query('INSERT INTO clientes_solucoes (cliente_id, solucao) VALUES (?, ?)', [id, solucao]);
      }
    }

    if (resultado.affectedRows === 0) {
      return res.status(404).json({ error: "Cliente não encontrado." });
    }

    res.json({ success: true, message: "Cliente atualizado com sucesso." });
  } catch (error) {
    console.error("Erro ao atualizar cliente:", error);
    res.status(500).json({ error: "Erro ao atualizar cliente." });
  }
});

// Excluir cliente pelo ID (DELETE /api/clientes/:id)
router.delete("/:id", autenticarToken, verificarPermissao('clientes.excluir'), async (req, res) => {
  const { id } = req.params;
  try {
    const [resultado] = await db.query(
      "DELETE FROM clientes WHERE id = ?",
      [id]
    );

    if (resultado.affectedRows === 0) {
      return res.status(404).json({ error: "Cliente não encontrado." });
    }

    res.json({ success: true, message: "Cliente excluído com sucesso." });
  } catch (error) {
    console.error("Erro ao excluir cliente:", error);
    res.status(500).json({ error: "Erro ao excluir cliente." });
  }
});

// ✅ Rota para transferir responsabilidade dos clientes (CORRIGIDA - apenas obrigações do usuário anterior)
router.put("/transferir-responsabilidade", autenticarToken, verificarPermissao('clientes.editar'), async (req, res) => {
  try {
    const { clienteIds, novoResponsavelId, empresaId, usuarioAnteriorId } = req.body;

    // ✅ Validações rápidas
    if (!clienteIds || !Array.isArray(clienteIds) || clienteIds.length === 0) {
      return res.status(400).json({ error: "IDs dos clientes são obrigatórios e devem ser um array." });
    }

    if (!novoResponsavelId) {
      return res.status(400).json({ error: "ID do novo responsável é obrigatório." });
    }

    if (!empresaId) {
      return res.status(400).json({ error: "ID da empresa é obrigatório." });
    }

    if (!usuarioAnteriorId) {
      return res.status(400).json({ error: "ID do usuário anterior é obrigatório para identificar quais obrigações transferir." });
    }

    // ✅ Verificar se o novo responsável existe (query única)
    const [usuario] = await db.query(
      "SELECT id, nome FROM usuarios WHERE id = ?",
      [novoResponsavelId]
    );

    if (usuario.length === 0) {
      return res.status(404).json({ error: "Usuário responsável não encontrado." });
    }

    // ✅ ATUALIZAÇÃO CORRETA - apenas obrigações onde o usuário ANTERIOR era responsável
    const [resultado] = await db.query(
      `UPDATE obrigacoes_responsaveis_cliente 
       SET usuarioId = ?, atualizadoEm = NOW() 
       WHERE clienteId IN (?) AND usuarioId = ?`,
      [novoResponsavelId, clienteIds, usuarioAnteriorId]
    );

    // ✅ Contar quantas linhas foram afetadas
    const totalAtualizacoes = resultado.affectedRows;

    // ✅ Resposta imediata
    res.json({
      success: true,
      message: `Responsabilidade de ${clienteIds.length} cliente(s) ATUALIZADA com sucesso para ${usuario[0].nome}.`,
      dados: {
        clientesTransferidos: clienteIds.length,
        totalAtualizacoes: totalAtualizacoes,
        usuarioAnterior: usuarioAnteriorId,
        novoResponsavel: usuario[0].nome,
        dataTransferencia: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error("Erro ao transferir responsabilidade:", error);
    res.status(500).json({ 
      error: "Erro interno do servidor ao transferir responsabilidade dos clientes." 
    });
  }
});

module.exports = router;
