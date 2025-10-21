const express = require("express");
const router = express.Router();
const verifyToken = require("../../middlewares/auth");
const automacaoRecorrencia = require("../../services/financeiro/automacaoRecorrencia");

// 🔄 Executar automação manualmente
router.post("/executar", verifyToken, async (req, res) => {
  try {
    console.log("🚀 Iniciando execução manual da automação...");
    
    const resultados = await automacaoRecorrencia.verificarContratosParaBoleto();
    
    // Separar resultados por tipo
    const contratosProcessados = resultados.filter(r => r.contrato_id);
    const vendasProcessadas = resultados.filter(r => r.venda_id);
    
    console.log(`📊 Resultado: ${contratosProcessados.length} contratos + ${vendasProcessadas.length} vendas = ${resultados.length} itens processados`);
    
    res.json({ 
      success: true, 
      message: `Automação executada com sucesso! ${contratosProcessados.length} contratos e ${vendasProcessadas.length} vendas processados.`,
      contratosProcessados,
      vendasProcessadas,
      totalProcessados: resultados.length
    });
  } catch (error) {
    console.error("❌ Erro na execução manual:", error);
    res.status(500).json({ 
      error: "Erro ao executar automação.",
      details: error.message 
    });
  }
});

// 📊 Status da automação
router.get("/status", verifyToken, async (req, res) => {
  try {
    const pool = require("../config/database");
    
    // Contar contratos com recorrência indeterminada
    const [[contratosIndeterminados]] = await pool.query(`
      SELECT COUNT(*) as total
      FROM contratos c
      INNER JOIN recorrencia_vendas_contratos rvc ON c.id = rvc.contrato_id
      WHERE rvc.tipo_origem = 'contrato'
        AND rvc.indeterminado = 1 
        AND rvc.status = 'ativo'
        AND c.status = 'ativo'
    `);

    // Contar vendas com recorrência indeterminada
    const [[vendasIndeterminadas]] = await pool.query(`
      SELECT COUNT(*) as total
      FROM vendas v
      INNER JOIN recorrencia_vendas_contratos rvc ON v.id = rvc.venda_id
      WHERE rvc.tipo_origem = 'venda'
        AND rvc.indeterminado = 1 
        AND rvc.status = 'ativo'
        AND v.situacao IN ('ativo', 'aprovado')
    `);

    // Contar contratos que precisam de boleto
    const [[contratosParaBoleto]] = await pool.query(`
      SELECT COUNT(*) as total
      FROM contratos c
      INNER JOIN recorrencia_vendas_contratos rvc ON c.id = rvc.contrato_id
      WHERE rvc.tipo_origem = 'contrato'
        AND rvc.indeterminado = 1 
        AND rvc.status = 'ativo'
        AND c.status = 'ativo'
        AND (c.proximo_vencimento IS NULL OR c.proximo_vencimento <= DATE_ADD(CURDATE(), INTERVAL 5 DAY))
    `);

    // Contar vendas que precisam de boleto
    const [[vendasParaBoleto]] = await pool.query(`
      SELECT COUNT(*) as total
      FROM vendas v
      INNER JOIN recorrencia_vendas_contratos rvc ON v.id = rvc.venda_id
      WHERE rvc.tipo_origem = 'venda'
        AND rvc.indeterminado = 1 
        AND rvc.status = 'ativo'
        AND v.situacao IN ('ativo', 'aprovado')
        AND (v.vencimento IS NULL OR v.vencimento <= DATE_ADD(CURDATE(), INTERVAL 5 DAY))
    `);

    // Debug: Verificar todos os contratos com recorrência
    const [todosContratos] = await pool.query(`
      SELECT 
        c.id,
        c.proximo_vencimento,
        c.status,
        rvc.indeterminado,
        rvc.status as rvc_status,
        CURDATE() as hoje,
        DATE_ADD(CURDATE(), INTERVAL 5 DAY) as limite_5_dias
      FROM contratos c
      INNER JOIN recorrencia_vendas_contratos rvc ON c.id = rvc.contrato_id
      WHERE c.status = 'ativo'
    `);

    // Últimos boletos gerados
    const [ultimosBoletos] = await pool.query(`
      SELECT 
        b.id,
        b.seu_numero,
        b.valor_nominal,
        b.data_vencimento,
        b.status,
        b.contrato_id,
        cli.nome_fantasia AS cliente_nome
      FROM boletos b
      LEFT JOIN contratos c ON b.contrato_id = c.id
      LEFT JOIN clientes cli ON c.cliente_id = cli.id
      ORDER BY b.created_at DESC
      LIMIT 10
    `);

    res.json({
      status: "ativo",
      contratosIndeterminados: contratosIndeterminados.total,
      vendasIndeterminadas: vendasIndeterminadas.total,
      contratosParaBoleto: contratosParaBoleto.total,
      vendasParaBoleto: vendasParaBoleto.total,
      ultimosBoletos,
      ultimaVerificacao: new Date().toISOString(),
      debug: {
        todosContratos,
        dataAtual: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error("❌ Erro ao buscar status:", error);
    res.status(500).json({ error: "Erro ao buscar status da automação." });
  }
});

// 📋 Listar contratos que precisam de boleto
router.get("/contratos-pendentes", verifyToken, async (req, res) => {
  try {
    const pool = require("../config/database");
    
    const [contratos] = await pool.query(`
      SELECT 
        c.id AS contrato_id,
        c.valor,
        c.proximo_vencimento,
        c.dia_gerado,
        c.status AS contrato_status,
        rvc.tipo_intervalo,
        rvc.intervalo,
        cli.nome_fantasia AS cliente_nome,
        cli.e_mail_principal AS cliente_email,
        co.nome AS empresa_nome,
        DATEDIFF(c.proximo_vencimento, CURDATE()) AS dias_para_vencer
      FROM contratos c
      INNER JOIN recorrencia_vendas_contratos rvc ON c.id = rvc.contrato_id
      LEFT JOIN clientes cli ON c.cliente_id = cli.id
      LEFT JOIN companies co ON c.company_id = co.id
      WHERE rvc.indeterminado = 1 
        AND rvc.status = 'ativo'
        AND c.status = 'ativo'
        AND (c.proximo_vencimento IS NULL OR c.proximo_vencimento <= DATE_ADD(CURDATE(), INTERVAL 5 DAY))
      ORDER BY c.proximo_vencimento ASC
    `);

    res.json(contratos);
  } catch (error) {
    console.error("❌ Erro ao listar contratos pendentes:", error);
    res.status(500).json({ error: "Erro ao listar contratos pendentes." });
  }
});

// 🎯 Processar contrato específico
router.post("/processar-contrato/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const pool = require("../config/database");
    
    // Buscar dados do contrato
    const [contratos] = await pool.query(`
      SELECT 
        c.id AS contrato_id,
        c.valor,
        c.proximo_vencimento,
        c.dia_gerado,
        c.status AS contrato_status,
        rvc.id AS recorrencia_id,
        rvc.tipo_intervalo,
        rvc.intervalo,
        rvc.indeterminado,
        cli.nome_fantasia AS cliente_nome,
        cli.e_mail_principal AS cliente_email,
        cli.cnpj AS cliente_cpf_cnpj,
        co.nome AS empresa_nome
      FROM contratos c
      INNER JOIN recorrencia_vendas_contratos rvc ON c.id = rvc.contrato_id
      LEFT JOIN clientes cli ON c.cliente_id = cli.id
      LEFT JOIN companies co ON c.company_id = co.id
      WHERE c.id = ?
    `, [id]);

    if (contratos.length === 0) {
      return res.status(404).json({ error: "Contrato não encontrado." });
    }

    const contrato = contratos[0];
    
    // Verificar se é indeterminado
    if (!contrato.indeterminado) {
      return res.status(400).json({ error: "Contrato não possui recorrência indeterminada." });
    }

    // Processar contrato
    await automacaoRecorrencia.processarContrato(contrato);
    
    res.json({ 
      success: true, 
      message: `Contrato ${id} processado com sucesso!` 
    });
  } catch (error) {
    console.error("❌ Erro ao processar contrato específico:", error);
    res.status(500).json({ 
      error: "Erro ao processar contrato.",
      details: error.message 
    });
  }
});

// 🧪 Teste de email (remover em produção)
router.post("/teste-email", verifyToken, async (req, res) => {
  try {
    const { email } = req.body; // Permitir email personalizado
    
    // Verificar se as variáveis estão configuradas
    if (!process.env.EMAIL_USER || !process.env.EMAIL_APP_PASSWORD) {
      return res.status(400).json({ 
        error: "Credenciais de email não configuradas.",
        details: {
          EMAIL_USER: process.env.EMAIL_USER ? "✅ Configurado" : "❌ Não configurado",
          EMAIL_APP_PASSWORD: process.env.EMAIL_APP_PASSWORD ? "✅ Configurado" : "❌ Não configurado"
        }
      });
    }

    const { sendEmail } = require("../config/email");
    
    const emailDestino = email || process.env.EMAIL_ADMIN || "admin@example.com"; // Email padrão se não fornecido
    
    const subject = "🧪 Teste de Email - Automação de Recorrência";
    const htmlContent = `
      <h2>Teste de Email</h2>
      <p>Este é um email de teste da automação de recorrência.</p>
      <p><strong>Data:</strong> ${new Date().toLocaleString('pt-BR')}</p>
      <p><strong>Status:</strong> ✅ Sistema funcionando corretamente</p>
      <p><strong>Enviado para:</strong> ${emailDestino}</p>
    `;

    await sendEmail(emailDestino, subject, htmlContent);
    
    res.json({ 
      success: true, 
      message: "Email de teste enviado com sucesso!" 
    });
  } catch (error) {
    console.error("❌ Erro no teste de email:", error);
    res.status(500).json({ 
      error: "Erro ao enviar email de teste.",
      details: error.message 
    });
  }
});

// 🧪 Teste específico para vendas com recorrência
router.get("/teste-vendas-recorrencia", verifyToken, async (req, res) => {
  try {
    const pool = require("../config/database");
    
    // 1. Verificar vendas com recorrência
    const [vendasComRecorrencia] = await pool.query(`
      SELECT 
        v.id as venda_id,
        v.cliente_id,
        v.valor_venda,
        v.vencimento,
        v.situacao,
        rvc.tipo_origem,
        rvc.indeterminado,
        rvc.status as rvc_status,
        cli.nome_fantasia,
        cli.cnpj,
        cli.e_mail_principal
      FROM vendas v
      LEFT JOIN recorrencia_vendas_contratos rvc ON v.id = rvc.venda_id
      LEFT JOIN clientes cli ON v.cliente_id = cli.id
      WHERE rvc.tipo_origem = 'venda'
      ORDER BY v.created_at DESC
    `);

    // 2. Verificar vendas que poderiam ter recorrência
    const [vendasSemRecorrencia] = await pool.query(`
      SELECT 
        v.id as venda_id,
        v.cliente_id,
        v.valor_venda,
        v.vencimento,
        v.situacao,
        cli.nome_fantasia,
        cli.cnpj,
        cli.e_mail_principal
      FROM vendas v
      LEFT JOIN clientes cli ON v.cliente_id = cli.id
      LEFT JOIN recorrencia_vendas_contratos rvc ON v.id = rvc.venda_id
      WHERE rvc.id IS NULL
        AND v.situacao IN ('ativo', 'aprovado')
        AND v.cliente_id IS NOT NULL
      ORDER BY v.created_at DESC
      LIMIT 10
    `);

    // 3. Estatísticas gerais
    const [[totalVendas]] = await pool.query("SELECT COUNT(*) as total FROM vendas");
    const [[vendasAtivas]] = await pool.query("SELECT COUNT(*) as total FROM vendas WHERE situacao IN ('ativo', 'aprovado')");
    const [[recorrenciasVendas]] = await pool.query("SELECT COUNT(*) as total FROM recorrencia_vendas_contratos WHERE tipo_origem = 'venda'");

    res.json({
      estatisticas: {
        totalVendas: totalVendas.total,
        vendasAtivas: vendasAtivas.total,
        recorrenciasVendas: recorrenciasVendas.total
      },
      vendasComRecorrencia,
      vendasSemRecorrencia: vendasSemRecorrencia.slice(0, 5) // Apenas 5 primeiras
    });
  } catch (error) {
    console.error("❌ Erro ao testar vendas com recorrência:", error);
    res.status(500).json({ error: "Erro ao testar vendas com recorrência." });
  }
});

// 🧪 Teste específico para contratos com recorrência
router.get("/teste-contratos-recorrencia", verifyToken, async (req, res) => {
  try {
    const pool = require("../config/database");
    
    // 1. Verificar contratos com recorrência
    const [contratosComRecorrencia] = await pool.query(`
      SELECT 
        c.id as contrato_id,
        c.cliente_id,
        c.valor,
        c.proximo_vencimento,
        c.status,
        rvc.tipo_origem,
        rvc.indeterminado,
        rvc.status as rvc_status,
        cli.nome_fantasia,
        cli.cnpj,
        cli.e_mail_principal
      FROM contratos c
      LEFT JOIN recorrencia_vendas_contratos rvc ON c.id = rvc.contrato_id
      LEFT JOIN clientes cli ON c.cliente_id = cli.id
      WHERE rvc.tipo_origem = 'contrato'
      ORDER BY c.created_at DESC
    `);

    // 2. Verificar contratos que poderiam ter recorrência
    const [contratosSemRecorrencia] = await pool.query(`
      SELECT 
        c.id as contrato_id,
        c.cliente_id,
        c.valor,
        c.proximo_vencimento,
        c.status,
        cli.nome_fantasia,
        cli.cnpj,
        cli.e_mail_principal
      FROM contratos c
      LEFT JOIN clientes cli ON c.cliente_id = cli.id
      LEFT JOIN recorrencia_vendas_contratos rvc ON c.id = rvc.contrato_id
      WHERE rvc.id IS NULL
        AND c.status = 'ativo'
        AND c.cliente_id IS NOT NULL
      ORDER BY c.created_at DESC
      LIMIT 10
    `);

    // 3. Estatísticas gerais
    const [[totalContratos]] = await pool.query("SELECT COUNT(*) as total FROM contratos");
    const [[contratosAtivos]] = await pool.query("SELECT COUNT(*) as total FROM contratos WHERE status = 'ativo'");
    const [[recorrenciasContratos]] = await pool.query("SELECT COUNT(*) as total FROM recorrencia_vendas_contratos WHERE tipo_origem = 'contrato'");

    res.json({
      estatisticas: {
        totalContratos: totalContratos.total,
        contratosAtivos: contratosAtivos.total,
        recorrenciasContratos: recorrenciasContratos.total
      },
      contratosComRecorrencia,
      contratosSemRecorrencia: contratosSemRecorrencia.slice(0, 5) // Apenas 5 primeiros
    });
  } catch (error) {
    console.error("❌ Erro ao testar contratos com recorrência:", error);
    res.status(500).json({ error: "Erro ao testar contratos com recorrência." });
  }
});

// 🧪 Teste completo - contratos e vendas com recorrência
router.get("/teste-completo-recorrencia", verifyToken, async (req, res) => {
  try {
    const pool = require("../config/database");
    
    // 1. Verificar contratos com recorrência
    const [contratosComRecorrencia] = await pool.query(`
      SELECT 
        c.id as contrato_id,
        c.cliente_id,
        c.valor,
        c.proximo_vencimento,
        c.status,
        rvc.tipo_origem,
        rvc.indeterminado,
        rvc.status as rvc_status,
        cli.nome_fantasia,
        cli.cnpj,
        cli.e_mail_principal
      FROM contratos c
      LEFT JOIN recorrencia_vendas_contratos rvc ON c.id = rvc.contrato_id
      LEFT JOIN clientes cli ON c.cliente_id = cli.id
      WHERE rvc.tipo_origem = 'contrato'
        AND rvc.indeterminado = 1
        AND rvc.status = 'ativo'
        AND c.status = 'ativo'
        AND (c.proximo_vencimento IS NULL OR c.proximo_vencimento <= DATE_ADD(CURDATE(), INTERVAL 5 DAY))
      ORDER BY c.proximo_vencimento ASC
    `);

    // 2. Verificar vendas com recorrência
    const [vendasComRecorrencia] = await pool.query(`
      SELECT 
        v.id as venda_id,
        v.cliente_id,
        v.valor_venda,
        v.vencimento as proximo_vencimento,
        v.situacao as status,
        rvc.tipo_origem,
        rvc.indeterminado,
        rvc.status as rvc_status,
        cli.nome_fantasia,
        cli.cnpj,
        cli.e_mail_principal
      FROM vendas v
      LEFT JOIN recorrencia_vendas_contratos rvc ON v.id = rvc.venda_id
      LEFT JOIN clientes cli ON v.cliente_id = cli.id
      WHERE rvc.tipo_origem = 'venda'
        AND rvc.indeterminado = 1
        AND rvc.status = 'ativo'
        AND v.situacao IN ('ativo', 'aprovado')
        AND (v.vencimento IS NULL OR v.vencimento <= DATE_ADD(CURDATE(), INTERVAL 5 DAY))
      ORDER BY v.vencimento ASC
    `);

    // 3. Combinar resultados (igual à automação)
    const todosItens = [
      ...contratosComRecorrencia.map(c => ({ ...c, id: c.contrato_id, tipo: 'contrato' })),
      ...vendasComRecorrencia.map(v => ({ ...v, id: v.venda_id, tipo: 'venda' }))
    ].sort((a, b) => {
      const dataA = a.proximo_vencimento ? new Date(a.proximo_vencimento) : new Date();
      const dataB = b.proximo_vencimento ? new Date(b.proximo_vencimento) : new Date();
      return dataA - dataB;
    });

    // 4. Estatísticas gerais
    const [[totalContratos]] = await pool.query("SELECT COUNT(*) as total FROM contratos");
    const [[totalVendas]] = await pool.query("SELECT COUNT(*) as total FROM vendas");
    const [[recorrenciasContratos]] = await pool.query("SELECT COUNT(*) as total FROM recorrencia_vendas_contratos WHERE tipo_origem = 'contrato'");
    const [[recorrenciasVendas]] = await pool.query("SELECT COUNT(*) as total FROM recorrencia_vendas_contratos WHERE tipo_origem = 'venda'");

    res.json({
      estatisticas: {
        totalContratos: totalContratos.total,
        totalVendas: totalVendas.total,
        recorrenciasContratos: recorrenciasContratos.total,
        recorrenciasVendas: recorrenciasVendas.total
      },
      contratosComRecorrencia,
      vendasComRecorrencia,
      todosItens: todosItens.slice(0, 10), // Apenas 10 primeiros para não sobrecarregar
      resumo: {
        totalItens: todosItens.length,
        contratos: contratosComRecorrencia.length,
        vendas: vendasComRecorrencia.length
      }
    });
  } catch (error) {
    console.error("❌ Erro ao testar recorrências completas:", error);
    res.status(500).json({ error: "Erro ao testar recorrências completas." });
  }
});

// 🎯 SIMULAR RENOVAÇÃO ANUAL (para testar no Postman)
router.post("/simular-renovacao-anual", verifyToken, async (req, res) => {
  try {
    const { contrato_id, forcar_dezembro } = req.body;
    const pool = require("../config/database");
    
    console.log("🎯 SIMULAÇÃO: Iniciando renovação anual...");
    
    if (contrato_id) {
      // Renovar contrato específico
      console.log(`🎯 SIMULAÇÃO: Renovando contrato específico ${contrato_id}...`);
      
      // Buscar dados do contrato
      const [contratos] = await pool.query(`
        SELECT 
          c.id as contrato_id,
          c.cliente_id,
          c.valor,
          c.data_inicio,
          c.categoria_id,
          c.sub_categoria_id,
          c.company_id,
          cli.nome_fantasia as cliente_nome
        FROM contratos c
        LEFT JOIN clientes cli ON c.cliente_id = cli.id
        WHERE c.id = ? AND c.status = 'ativo'
      `, [contrato_id]);

      if (contratos.length === 0) {
        return res.status(404).json({ error: "Contrato não encontrado ou inativo." });
      }

      const contrato = contratos[0];
      
      // Verificar se já existem vendas para o próximo ano
      const proximoAno = new Date().getFullYear() + 1;
      const [vendasExistentes] = await pool.query(`
        SELECT COUNT(*) as count FROM vendas 
        WHERE contrato_origem_id = ? AND ano_referencia = ?
      `, [contrato_id, proximoAno]);

      if (vendasExistentes[0].count > 0) {
        return res.status(400).json({ 
          error: `Vendas para o ano ${proximoAno} já existem para este contrato.`,
          vendas_existentes: vendasExistentes[0].count
        });
      }

      // Gerar vendas para o próximo ano
      await automacaoRecorrencia.gerarVendasProximoAno(contrato_id);
      
      res.json({ 
        success: true, 
        message: `Vendas do ano ${proximoAno} geradas com sucesso para contrato ${contrato_id}!`,
        contrato: contrato,
        ano_gerado: proximoAno
      });
      
    } else {
      // Renovar todos os contratos elegíveis
      console.log("🎯 SIMULAÇÃO: Renovando todos os contratos elegíveis...");
      
      // Temporariamente simular que estamos em dezembro se forçar
      if (forcar_dezembro) {
        console.log("🎯 SIMULAÇÃO: Forçando modo dezembro...");
        // Chama a função de renovação diretamente
        await automacaoRecorrencia.verificarRenovacaoAnual();
      } else {
        // Verificar mês atual
        const mesAtual = new Date().getMonth() + 1;
        if (mesAtual !== 12) {
          return res.status(400).json({ 
            error: "Renovação automática só funciona em dezembro.",
            mes_atual: mesAtual,
            dica: "Use 'forcar_dezembro': true para simular"
          });
        }
        
        await automacaoRecorrencia.verificarRenovacaoAnual();
      }
      
      res.json({ 
        success: true, 
        message: "Renovação anual executada com sucesso!",
        mes_atual: new Date().getMonth() + 1,
        forcar_dezembro: forcar_dezembro || false
      });
    }
    
  } catch (error) {
    console.error("❌ Erro na simulação de renovação anual:", error);
    res.status(500).json({ 
      error: "Erro ao simular renovação anual.",
      details: error.message 
    });
  }
});

// 📊 Verificar status de renovação anual
router.get("/status-renovacao-anual", verifyToken, async (req, res) => {
  try {
    const pool = require("../config/database");
    const anoAtual = new Date().getFullYear();
    const proximoAno = anoAtual + 1;
    const mesAtual = new Date().getMonth() + 1;
    
    // Contratos que podem ser renovados
    const [contratosElegiveis] = await pool.query(`
      SELECT DISTINCT
        c.id as contrato_id,
        c.cliente_id,
        c.valor,
        c.data_inicio,
        cli.nome_fantasia as cliente_nome,
        COUNT(v.id) as vendas_total,
        COUNT(CASE WHEN v.situacao = 'processado' THEN 1 END) as vendas_processadas,
        MAX(v.ano_referencia) as ultimo_ano,
        MAX(v.mes_referencia) as ultimo_mes
      FROM contratos c
      INNER JOIN vendas v ON v.contrato_origem_id = c.id
      INNER JOIN recorrencia_vendas_contratos rvc ON c.id = rvc.contrato_id
      LEFT JOIN clientes cli ON c.cliente_id = cli.id
      WHERE c.status = 'ativo'
        AND rvc.tipo_origem = 'contrato'
        AND rvc.indeterminado = 1
        AND rvc.status = 'ativo'
        AND v.ano_referencia = ?
      GROUP BY c.id
      HAVING vendas_processadas >= (vendas_total - 1)
        AND ultimo_ano = ?
        AND ultimo_mes >= 11
    `, [anoAtual, anoAtual]);

    // Contratos que já têm vendas para o próximo ano
    const [contratosJaRenovados] = await pool.query(`
      SELECT DISTINCT
        c.id as contrato_id,
        c.cliente_id,
        cli.nome_fantasia as cliente_nome,
        COUNT(v2.id) as vendas_proximo_ano
      FROM contratos c
      INNER JOIN vendas v2 ON v2.contrato_origem_id = c.id
      LEFT JOIN clientes cli ON c.cliente_id = cli.id
      WHERE c.status = 'ativo'
        AND v2.ano_referencia = ?
      GROUP BY c.id
    `, [proximoAno]);

    res.json({
      status: {
        mes_atual: mesAtual,
        ano_atual: anoAtual,
        proximo_ano: proximoAno,
        pode_renovar: mesAtual === 12
      },
      contratos_elegiveis: contratosElegiveis,
      contratos_ja_renovados: contratosJaRenovados,
      resumo: {
        total_elegiveis: contratosElegiveis.length,
        total_ja_renovados: contratosJaRenovados.length,
        aguardando_renovacao: contratosElegiveis.length - contratosJaRenovados.length
      }
    });
    
  } catch (error) {
    console.error("❌ Erro ao verificar status de renovação:", error);
    res.status(500).json({ error: "Erro ao verificar status de renovação." });
  }
});


module.exports = router; 