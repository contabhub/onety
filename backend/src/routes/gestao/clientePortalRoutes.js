const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require('../../config/database');
const JWT_SECRET = process.env.JWT_SECRET;

// =====================================================
// MIDDLEWARE DE AUTENTICAÇÃO DO CLIENTE
// =====================================================

const autenticarCliente = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: "Token não fornecido." });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    
    if (decoded.tipo !== 'cliente') {
      return res.status(401).json({ error: "Token inválido para cliente." });
    }

    // Buscar dados do cliente
    const [clientes] = await db.query(`
      SELECT 
        c.*, 
        e.razaoSocial as empresaNome,
        ca.ativo as acesso_ativo
      FROM clientes c
      JOIN empresas e ON c.empresaId = e.id
      LEFT JOIN cliente_acesso ca ON c.id = ca.clienteId
      WHERE c.id = ? AND c.status = 'Ativo'
    `, [decoded.clienteId]);

    if (clientes.length === 0 || !clientes[0].acesso_ativo) {
      return res.status(401).json({ error: "Cliente não encontrado ou acesso desativado." });
    }

    // Adicionar dados do cliente ao request
    req.cliente = {
      id: clientes[0].id,
      nome: clientes[0].nome,
      apelido: clientes[0].apelido,
      cnpjCpf: clientes[0].cnpjCpf,
      empresaId: clientes[0].empresaId,
      empresaNome: clientes[0].empresaNome
    };

    next();
  } catch (error) {
    console.error("❌ Erro na autenticação do cliente:", error);
    res.status(401).json({ error: "Token inválido." });
  }
};

// =====================================================
// ROTAS PÚBLICAS (não precisam de autenticação)
// =====================================================

/**
 * POST /api/cliente/login
 * Login do cliente no portal
 */
router.post("/login", async (req, res) => {
  try {
    const { cnpjCpf, senha, empresaId } = req.body;

    if (!cnpjCpf || !senha) {
      return res.status(400).json({ error: "CNPJ/CPF e senha são obrigatórios." });
    }

    // Buscar cliente por CNPJ/CPF
    let query = `
      SELECT 
        c.*, 
        e.razaoSocial as empresaNome, 
        e.id as empresaId,
        ca.senha_hash,
        ca.ativo as acesso_ativo
      FROM clientes c
      JOIN empresas e ON c.empresaId = e.id
      LEFT JOIN cliente_acesso ca ON c.id = ca.clienteId
      WHERE c.cnpjCpf = ? AND c.status = 'Ativo'
    `;
    
    let params = [cnpjCpf];
    
    // Se empresaId foi fornecido, filtrar por empresa
    if (empresaId) {
      query += ` AND c.empresaId = ?`;
      params.push(empresaId);
    }
    
    const [clientes] = await db.query(query, params);

    if (clientes.length === 0) {
      return res.status(401).json({ error: "Cliente não encontrado." });
    }

    const cliente = clientes[0];

    // Se não tem acesso configurado, criar um
    if (!cliente.senha_hash) {
      // Gerar senha padrão (primeiros 6 dígitos do CNPJ)
      const senhaPadrao = cnpjCpf.replace(/\D/g, '').substring(0, 6);
      const senhaHash = await bcrypt.hash(senhaPadrao, 10);
      
      await db.query(`
        INSERT INTO cliente_acesso (clienteId, senha_hash)
        VALUES (?, ?)
      `, [cliente.id, senhaHash]);
      
      cliente.senha_hash = senhaHash;
      cliente.acesso_ativo = true;
    }

    // Verificar se o acesso está ativo
    if (!cliente.acesso_ativo) {
      return res.status(401).json({ error: "Acesso do cliente está desativado." });
    }

    // Verificar senha
    const senhaValida = await bcrypt.compare(senha, cliente.senha_hash);
    if (!senhaValida) {
      return res.status(401).json({ error: "Senha incorreta." });
    }

    // Atualizar último acesso
    await db.query(`
      UPDATE cliente_acesso 
      SET ultimo_acesso = NOW() 
      WHERE clienteId = ?
    `, [cliente.id]);

    // Gerar token JWT
    const token = jwt.sign(
      { 
        clienteId: cliente.id, 
        empresaId: cliente.empresaId,
        tipo: 'cliente'
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      cliente: {
        id: cliente.id,
        nome: cliente.nome,
        apelido: cliente.apelido,
        cnpjCpf: cliente.cnpjCpf,
        empresaNome: cliente.empresaNome,
        empresaId: cliente.empresaId
      },
      token
    });

  } catch (error) {
    console.error("❌ Erro no login do cliente:", error);
    res.status(500).json({ error: "Erro interno no servidor." });
  }
});

/**
 * GET /api/cliente/verificar-token
 * Verificar se o token do cliente é válido
 */
router.get("/verificar-token", async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: "Token não fornecido." });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    
    if (decoded.tipo !== 'cliente') {
      return res.status(401).json({ error: "Token inválido para cliente." });
    }

    // Buscar dados do cliente
    const [clientes] = await db.query(`
      SELECT 
        c.*, 
        e.razaoSocial as empresaNome,
        ca.ativo as acesso_ativo
      FROM clientes c
      JOIN empresas e ON c.empresaId = e.id
      LEFT JOIN cliente_acesso ca ON c.id = ca.clienteId
      WHERE c.id = ? AND c.status = 'Ativo'
    `, [decoded.clienteId]);

    if (clientes.length === 0 || !clientes[0].acesso_ativo) {
      return res.status(401).json({ error: "Cliente não encontrado ou acesso desativado." });
    }

    res.json({
      cliente: {
        id: clientes[0].id,
        nome: clientes[0].nome,
        apelido: clientes[0].apelido,
        cnpjCpf: clientes[0].cnpjCpf,
        empresaNome: clientes[0].empresaNome,
        empresaId: clientes[0].empresaId
      }
    });

  } catch (error) {
    console.error("❌ Erro ao verificar token do cliente:", error);
    res.status(401).json({ error: "Token inválido." });
  }
});

/**
 * GET /api/cliente/config/:empresaId
 * Buscar configuração do portal da empresa
 */
router.get("/config/:empresaId", async (req, res) => {
  try {
    const { empresaId } = req.params;

    const [configs] = await db.query(`
      SELECT * FROM portal_cliente_config 
      WHERE empresaId = ? AND ativo = true
    `, [empresaId]);

    if (configs.length === 0) {
      // Retornar configuração padrão
      return res.json({
        nome_portal: 'Portal do Cliente',
        cor_primaria: '#34225f',
        cor_texto: '#ffffff',
        logo_web: null,
        logo_mobile: null,
        background_web: null,
        background_mobile: null,
        favicon: null
      });
    }

    res.json(configs[0]);

  } catch (error) {
    console.error("❌ Erro ao buscar configuração do portal:", error);
    res.status(500).json({ error: "Erro interno no servidor." });
  }
});

// =====================================================
// ROTAS PROTEGIDAS (precisam de autenticação)
// =====================================================

/**
 * GET /api/cliente/dashboard
 * Dashboard do cliente
 */
router.get("/dashboard", autenticarCliente, async (req, res) => {
  try {
    const clienteId = req.cliente.id;
    const empresaId = req.cliente.empresaId;

    // Buscar resumo das obrigações do cliente
    const [obrigacoes] = await db.query(`
      SELECT 
        oc.id,
        oc.nome,
        oc.status,
        oc.vencimento,
        oc.dataBaixa,
        o.nome as nomeObrigacao,
        d.nome as departamentoNome
      FROM obrigacoes_clientes oc
      JOIN obrigacoes o ON oc.obrigacaoId = o.id
      LEFT JOIN departamentos d ON o.departamentoId = d.id
      WHERE oc.clienteId = ? AND oc.status != 'cancelada'
      ORDER BY oc.vencimento ASC
    `, [clienteId]);

    // Calcular estatísticas
    const hoje = new Date();
    const proximos30Dias = new Date();
    proximos30Dias.setDate(hoje.getDate() + 30);

    const estatisticas = {
      total: obrigacoes.length,
      pendentes: obrigacoes.filter(o => o.status === 'pendente').length,
      concluidas: obrigacoes.filter(o => o.status === 'concluida').length,
      vencidas: obrigacoes.filter(o => {
        const vencimento = new Date(o.vencimento);
        return vencimento < hoje && o.status !== 'concluida';
      }).length,
      proximos30Dias: obrigacoes.filter(o => {
        const vencimento = new Date(o.vencimento);
        return vencimento >= hoje && vencimento <= proximos30Dias && o.status !== 'concluida';
      }).length
    };

    res.json({
      cliente: req.cliente,
      estatisticas,
      obrigacoes: obrigacoes.slice(0, 10) // Últimas 10 obrigações
    });

  } catch (error) {
    console.error("❌ Erro ao buscar dashboard do cliente:", error);
    res.status(500).json({ error: "Erro interno no servidor." });
  }
});

/**
 * GET /api/cliente/obrigacoes
 * Listar obrigações do cliente
 */
router.get("/obrigacoes", autenticarCliente, async (req, res) => {
  try {
    const clienteId = req.cliente.id;
    const { status, mes, ano } = req.query;

    let whereClause = "WHERE oc.clienteId = ? AND oc.status != 'cancelada'";
    const params = [clienteId];

    if (status) {
      whereClause += " AND oc.status = ?";
      params.push(status);
    }

    if (mes && ano) {
      whereClause += " AND oc.mes_referencia = ? AND oc.ano_referencia = ?";
      params.push(parseInt(mes), parseInt(ano));
    }

    const [obrigacoes] = await db.query(`
      SELECT 
        oc.id,
        oc.nome,
        oc.status,
        oc.vencimento,
        oc.dataBaixa,
        oc.ano_referencia,
        oc.mes_referencia,
        o.nome as nomeObrigacao,
        d.nome as departamentoNome,
        u.nome as responsavelNome
      FROM obrigacoes_clientes oc
      JOIN obrigacoes o ON oc.obrigacaoId = o.id
      LEFT JOIN departamentos d ON o.departamentoId = d.id
      LEFT JOIN usuarios u ON oc.responsavelId = u.id
      ${whereClause}
      ORDER BY oc.vencimento ASC
    `, params);

    res.json(obrigacoes);

  } catch (error) {
    console.error("❌ Erro ao buscar obrigações do cliente:", error);
    res.status(500).json({ error: "Erro interno no servidor." });
  }
});

/**
 * GET /api/cliente/obrigacoes/:id
 * Detalhes de uma obrigação específica
 */
router.get("/obrigacoes/:id", autenticarCliente, async (req, res) => {
  try {
    const { id } = req.params;
    const clienteId = req.cliente.id;

    const [obrigacoes] = await db.query(`
      SELECT 
        oc.*,
        o.nome as nomeObrigacao,
        o.descricao as descricaoObrigacao,
        d.nome as departamentoNome,
        u.nome as responsavelNome,
        u.email as responsavelEmail
      FROM obrigacoes_clientes oc
      JOIN obrigacoes o ON oc.obrigacaoId = o.id
      LEFT JOIN departamentos d ON o.departamentoId = d.id
      LEFT JOIN usuarios u ON oc.responsavelId = u.id
      WHERE oc.id = ? AND oc.clienteId = ?
    `, [id, clienteId]);

    if (obrigacoes.length === 0) {
      return res.status(404).json({ error: "Obrigação não encontrada." });
    }

    // Buscar atividades da obrigação
    const [atividades] = await db.query(`
      SELECT 
        oac.*,
        u.nome as concluidoPorNome
      FROM obrigacoes_atividades_clientes oac
      LEFT JOIN usuarios u ON oac.concluidoPor = u.id
      WHERE oac.obrigacaoClienteId = ?
      ORDER BY oac.ordem
    `, [id]);

    res.json({
      ...obrigacoes[0],
      atividades
    });

  } catch (error) {
    console.error("❌ Erro ao buscar detalhes da obrigação:", error);
    res.status(500).json({ error: "Erro interno no servidor." });
  }
});

module.exports = router; 