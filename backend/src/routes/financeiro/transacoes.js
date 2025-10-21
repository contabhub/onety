const express = require("express");
const router = express.Router();
const pool = require("../../config/database");
const verifyToken = require("../../middlewares/auth");
const pdfParse = require("pdf-parse");

// 🔹 Função para extrair valor de PDF de boleto
async function extractBoletoValueFromPDF(pdfBuffer) {
  try {
    // Extrair texto do PDF
    const pdfData = await pdfParse(pdfBuffer);
    const pdfText = pdfData.text;
    
    console.log('[DEBUG] Texto extraído do PDF:', pdfText.substring(0, 500) + '...');
    
    // Padrões para encontrar valores em boletos (ordenados por prioridade)
    const valorPatterns = [
      // Padrão "TOTAL A PAGAR: R$ 351,08" (mais específico)
      /TOTAL\s+A\s+PAGAR[:\s]*R?\$?\s*([\d,]+\.?\d*)/i,
      // Padrão "TOTAL A PAGAR" sem R$ (ex: "351,08")
      /TOTAL\s+A\s+PAGAR[:\s]*([\d,]+\.?\d*)/i,
      // Padrão "Valor: R$ 351.08"
      /Valor[:\s]*R?\$?\s*([\d,]+\.?\d*)/i,
      // Padrão "R$ 351,08" (mais genérico)
      /R\$\s*([\d,]+\.?\d*)/i,
      // Padrão apenas números com vírgula/ponto (ex: "351,08")
      /([\d,]+\.?\d*)\s*reais?/i,
      // Padrão para valores em linha digitável (últimos 10 dígitos)
      /(\d{47})/g
    ];
    
    // Tentar encontrar valor usando os padrões
    for (const pattern of valorPatterns) {
      const matches = pdfText.match(pattern);
      if (matches && matches.length > 0) {
        let valor = null;
        
        // Se for linha digitável (47 dígitos), extrair valor dos últimos 10 dígitos
        if (pattern.source.includes('47')) {
          const linha = matches[0].replace(/[^\d]/g, '');
          if (linha.length === 47) {
            const valorStr = linha.slice(37, 47);
            valor = Number.parseInt(valorStr, 10) / 100;
            console.log('[DEBUG] Valor extraído da linha digitável:', valor);
            return valor;
          }
        } else {
          // Para outros padrões, converter string para número
          const valorStr = matches[1].replace(',', '.');
          valor = parseFloat(valorStr);
          if (!isNaN(valor) && valor > 0) {
            console.log('[DEBUG] Valor extraído do padrão:', pattern.source, '=', valor);
            return valor;
          }
        }
      }
    }
    
    // 🔹 Busca adicional por valores específicos de boletos
    const specificPatterns = [
      // Padrão para boletos de água (ex: "351,08")
      /(\d{1,3}(?:,\d{2})?)\s*$/m,
      // Padrão para valores em tabelas (ex: "833,67")
      /(\d{1,3}(?:,\d{2})?)\s*$/gm
    ];
    
    for (const pattern of specificPatterns) {
      const matches = pdfText.match(pattern);
      if (matches && matches.length > 0) {
        // Filtrar apenas valores que fazem sentido (entre 1 e 999999)
        const valores = matches
          .map(match => {
            const valorStr = match.replace(',', '.');
            const valor = parseFloat(valorStr);
            return !isNaN(valor) && valor > 0 && valor < 1000000 ? valor : null;
          })
          .filter(valor => valor !== null);
        
        if (valores.length > 0) {
          // Retornar o maior valor encontrado (geralmente é o total)
          const maiorValor = Math.max(...valores);
          console.log('[DEBUG] Valor extraído por padrão específico:', maiorValor);
          return maiorValor;
        }
      }
    }
    
    console.log('[DEBUG] Nenhum valor encontrado no PDF');
    return null;
    
  } catch (error) {
    console.error('[ERROR] Erro ao extrair valor do PDF:', error);
    return null;
  }
}

// 🔹 Criar transação com pluggy_transaction_id e boleto_id
router.post("/", verifyToken, async (req, res) => {
  const {
    conta_id,
    conta_api_id,
    company_id,
    tipo,
    valor,
    descricao,
    data_transacao,
    origem,
    data_vencimento,
    situacao,
    observacoes,
    parcelamento,
    intervalo_parcelas,
    categoria_id,
    sub_categoria_id,
    cliente_id,
    anexo_base64,
    centro_de_custo_id,
    pluggy_transaction_id, // ✅ NOVO CAMPO
    boleto_id
    
  } = req.body;

  try {
    let valorFinal = valor;
    
    // 🔹 Processar PDF se foi enviado no anexo_base64
    if (anexo_base64) {
      console.log('[DEBUG] PDF detectado na criação da transação');
      
      try {
        // Converter base64 para buffer
        const pdfBuffer = Buffer.from(anexo_base64, 'base64');
        
        // Extrair valor do PDF
        const valorExtraido = await extractBoletoValueFromPDF(pdfBuffer);
        
        if (valorExtraido) {
          valorFinal = valorExtraido;
          console.log(`[DEBUG] Valor extraído do PDF: R$ ${valorExtraido}`);
        } else {
          console.log('[DEBUG] Não foi possível extrair valor do PDF, mantendo valor original');
        }
      } catch (pdfError) {
        console.error('[ERROR] Erro ao processar PDF:', pdfError);
        // Em caso de erro no PDF, manter valor original
      }
    }

    const [result] = await pool.query(
      `
      INSERT INTO transacoes (
        conta_id, conta_api_id, company_id, tipo, valor, descricao, data_transacao, origem,
        data_vencimento, situacao, observacoes, parcelamento, intervalo_parcelas,
        categoria_id, sub_categoria_id, cliente_id,
        anexo_base64, centro_de_custo_id,
        pluggy_transaction_id, -- ✅ INSERE AQUI
        boleto_id,             -- ✅ INSIRA AQUI

        created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
      `,
      [
        conta_id,
        conta_api_id || null,
        company_id,
        tipo,
        valorFinal, // ✅ Usar valor extraído do PDF se disponível
        descricao,
        data_transacao,
        origem,
        data_vencimento,
        situacao,
        observacoes,
        parcelamento,
        intervalo_parcelas,
        categoria_id,
        sub_categoria_id || null,
        cliente_id || null,
        anexo_base64 || null,
        centro_de_custo_id || null,
        pluggy_transaction_id || null,
        boleto_id || null

      ]
    );

    const response = { 
      id: result.insertId, 
      message: "Transação criada com sucesso.",
      valor_atualizado: valorFinal
    };
    
    // Se o valor foi extraído do PDF, informar na resposta
    if (anexo_base64 && valorFinal !== valor) {
      response.valor_extraido_pdf = true;
      response.valor_original = valor;
      response.valor_novo = valorFinal;
    }

    res.status(201).json(response);
  } catch (error) {
    console.error("Erro ao criar transação:", error);
    res.status(500).json({ error: "Erro ao criar transação." });
  }
});

// 🔹 Listar todas as transações
router.get("/", verifyToken, async (req, res) => {
  try {
    const [result] = await pool.query(`
      SELECT 
        t.*, 
        ca.descricao_banco AS descricao_banco
      FROM transacoes t
      LEFT JOIN contas_api ca ON ca.id = t.conta_api_id
      ORDER BY t.created_at DESC
    `);
    res.json(result);
  } catch (error) {
    console.error("Erro ao listar transações:", error);
    res.status(500).json({ error: "Erro ao listar transações." });
  }
});

// 🔹 Buscar transação por ID
router.get("/:id", verifyToken, async (req, res) => {
  const { id } = req.params;

  try {
    const [rows] = await pool.query(
      `
        SELECT 
          t.*, 
          ca.descricao_banco AS descricao_banco
        FROM transacoes t
        LEFT JOIN contas_api ca ON ca.id = t.conta_api_id
        WHERE t.id = ?
      `,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Transação não encontrada." });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error("Erro ao buscar transação:", error);
    res.status(500).json({ error: "Erro ao buscar transação." });
  }
});

// 🔹 Buscar transações por Company ID com JOINs para categoria, subcategoria, tipo, cliente e centro_de_custo
router.get("/empresa/:companyId", verifyToken, async (req, res) => {
  const { companyId } = req.params;

  try {
    const [rows] = await pool.query(
      `
     SELECT 
      t.*,
      c.nome AS categoria_nome,
      sc.nome AS subcategoria_nome,
      tp.nome AS tipo_nome,
      cl.nome_fantasia AS cliente_nome_fantasia,
      ca.descricao_banco AS descricao_banco,
      cc.codigo AS centro_custo_codigo,         -- ✅ NOVO JOIN!
      cc.nome AS centro_custo_nome              -- ✅ NOVO JOIN!
    FROM transacoes t
    LEFT JOIN categorias c ON c.id = t.categoria_id
    LEFT JOIN sub_categorias sc ON sc.id = t.sub_categoria_id
    LEFT JOIN tipos tp ON tp.id = c.tipo_id
    LEFT JOIN clientes cl ON cl.id = t.cliente_id
    LEFT JOIN contas_api ca ON ca.id = t.conta_api_id
    LEFT JOIN centro_de_custo cc ON cc.id = t.centro_de_custo_id -- ✅ NOVO JOIN!
    WHERE t.company_id = ?
    ORDER BY t.created_at DESC
      `,
      [companyId]
    );

    res.json(rows);
  } catch (error) {
    console.error("Erro ao buscar transações por companyId:", error);
    res.status(500).json({ error: "Erro ao buscar transações por empresa." });
  }
});

// Buscar transações de entrada por Company ID + filtros via query
router.get("/empresa/:companyId/entradas", verifyToken, async (req, res) => {
  const { companyId } = req.params;
  const { status, vencimento } = req.query;

  let query = `
    SELECT 
      t.id,
      t.descricao,
      t.valor AS a_receber,
      t.data_transacao,
      t.data_vencimento,
      t.situacao,
      t.observacoes,
      t.parcelamento,
      t.intervalo_parcelas,
      t.anexo_base64,
      t.boleto_id,
      t.origem,
      t.conta_api_id,
      ca.descricao_banco AS descricao_banco,
      c.nome AS categoria_nome,
      sc.nome AS subcategoria_nome,
      tp.nome AS tipo_nome,
      cl.nome_fantasia AS cliente_nome_fantasia,
      cc.codigo AS centro_custo_codigo,
      cc.nome AS centro_custo_nome
    FROM transacoes t
    LEFT JOIN categorias c ON c.id = t.categoria_id
    LEFT JOIN sub_categorias sc ON sc.id = t.sub_categoria_id
    LEFT JOIN tipos tp ON tp.id = c.tipo_id
    LEFT JOIN clientes cl ON cl.id = t.cliente_id
    LEFT JOIN contas_api ca ON ca.id = t.conta_api_id
    LEFT JOIN centro_de_custo cc ON cc.id = t.centro_de_custo_id
    WHERE t.company_id = ? AND t.tipo = 'entrada'
  `;
  const params = [companyId];

  if (status) {
    query += ` AND t.situacao = ?`;
    params.push(status);
  }

  if (vencimento) {
    query += ` AND DATE(t.data_vencimento) = ?`;
    params.push(vencimento);
  }

  query += ` ORDER BY t.created_at DESC`;

  try {
    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (error) {
    console.error("Erro ao buscar transações de entrada:", error);
    res.status(500).json({ error: "Erro ao buscar transações de entrada por empresa." });
  }
});

// Buscar transações de saída por Company ID
router.get("/empresa/:companyId/saidas", verifyToken, async (req, res) => {
  const { companyId } = req.params;
  const { status, vencimento } = req.query;

  let query = `
    SELECT 
      t.id,
      t.descricao,
      t.valor AS a_pagar,
      t.data_transacao,
      t.data_vencimento,
      t.situacao,
      t.observacoes,
      t.parcelamento,
      t.intervalo_parcelas,
      t.anexo_base64,
      t.boleto_id,
      t.origem,
      t.conta_api_id,
      ca.descricao_banco AS descricao_banco,
      c.nome AS categoria_nome,
      sc.nome AS subcategoria_nome,
      tp.nome AS tipo_nome,
      cl.nome_fantasia AS cliente_nome_fantasia,
      cc.codigo AS centro_custo_codigo,
      cc.nome AS centro_custo_nome,
      -- �� CAMPOS DE CONCILIAÇÃO:
      con.transacao_api_id,
      con.id AS conciliacao_id,
      con.status AS conciliacao_status
    FROM transacoes t
    LEFT JOIN categorias c ON c.id = t.categoria_id
    LEFT JOIN sub_categorias sc ON sc.id = t.sub_categoria_id
    LEFT JOIN tipos tp ON tp.id = c.tipo_id
    LEFT JOIN clientes cl ON cl.id = t.cliente_id
    LEFT JOIN contas_api ca ON ca.id = t.conta_api_id
    LEFT JOIN centro_de_custo cc ON cc.id = t.centro_de_custo_id
    -- �� JOIN COM CONCILIAÇÕES:
    LEFT JOIN conciliacoes con ON con.transacao_id = t.id AND con.status = 'conciliada'
    WHERE t.company_id = ? AND t.tipo = 'saida'
  `;

  const params = [companyId];

  // Filtro opcional por status
  if (status) {
    query += ` AND t.situacao = ?`;
    params.push(status);
  }

  // Filtro opcional por data de vencimento
  if (vencimento) {
    query += ` AND DATE(t.data_vencimento) = ?`;
    params.push(vencimento);
  }

  query += ` ORDER BY t.created_at DESC`;

  try {
    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (error) {
    console.error("Erro ao buscar transações de saída:", error);
    res.status(500).json({ error: "Erro ao buscar transações de saída por empresa." });
  }
});
// 🔹 Atualizar transação (com pluggy_transaction_id e boleto_id)
router.put("/:id", verifyToken, async (req, res) => {
  const { id } = req.params;
  const {
    conta_id,
    conta_api_id,
    company_id,
    tipo,
    valor,
    descricao,
    data_transacao,
    origem,
    data_vencimento,
    situacao,
    observacoes,
    parcelamento,
    intervalo_parcelas,
    categoria_id,
    sub_categoria_id,
    cliente_id,
    anexo_base64,
    centro_de_custo_id,
    pluggy_transaction_id, // ✅ NOVO CAMPO
    boleto_id // ✅ NOVO CAMPO
  } = req.body;

  try {
    let valorFinal = valor;
    
    // 🔹 Processar PDF se foi enviado no anexo_base64
    if (anexo_base64) {
      console.log('[DEBUG] PDF detectado na atualização da transação');
      
      try {
        // Converter base64 para buffer
        const pdfBuffer = Buffer.from(anexo_base64, 'base64');
        
        // Extrair valor do PDF
        const valorExtraido = await extractBoletoValueFromPDF(pdfBuffer);
        
        if (valorExtraido) {
          valorFinal = valorExtraido;
          console.log(`[DEBUG] Valor extraído do PDF: R$ ${valorExtraido}`);
        } else {
          console.log('[DEBUG] Não foi possível extrair valor do PDF, mantendo valor original');
        }
      } catch (pdfError) {
        console.error('[ERROR] Erro ao processar PDF:', pdfError);
        // Em caso de erro no PDF, manter valor original
      }
    }

    const [result] = await pool.query(
      `
      UPDATE transacoes SET
        conta_id = ?, conta_api_id = ?, company_id = ?, tipo = ?, valor = ?, descricao = ?, 
        data_transacao = ?, origem = ?, data_vencimento = ?, situacao = ?, 
        observacoes = ?, parcelamento = ?, intervalo_parcelas = ?, 
        categoria_id = ?, sub_categoria_id = ?, cliente_id = ?,
        anexo_base64 = ?, centro_de_custo_id = ?,
        pluggy_transaction_id = ?, -- ✅ UPDATE TAMBÉM
        boleto_id = ? -- ✅ UPDATE TAMBÉM
      WHERE id = ?
      `,
      [
        conta_id,
        conta_api_id || null,
        company_id,
        tipo,
        valorFinal, // ✅ Usar valor extraído do PDF se disponível
        descricao,
        data_transacao,
        origem,
        data_vencimento,
        situacao,
        observacoes,
        parcelamento,
        intervalo_parcelas,
        categoria_id,
        sub_categoria_id || null,
        cliente_id || null,
        anexo_base64 || null,
        centro_de_custo_id || null,
        pluggy_transaction_id || null,
        boleto_id || null,
        id
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Transação não encontrada." });
    }

    const response = { 
      message: "Transação atualizada com sucesso.",
      valor_atualizado: valorFinal
    };
    
    // Se o valor foi extraído do PDF, informar na resposta
    if (anexo_base64 && valorFinal !== valor) {
      response.valor_extraido_pdf = true;
      response.valor_original = valor;
      response.valor_novo = valorFinal;
    }

    res.json(response);
  } catch (error) {
    console.error("Erro ao atualizar transação:", error);
    res.status(500).json({ error: "Erro ao atualizar transação." });
  }
});

// 🔹 Atualizar parcialmente transação (situacao e/ou data_transacao)
router.patch("/:id", verifyToken, async (req, res) => {
  const { id } = req.params;
  const { situacao, data_transacao } = req.body;

  // Valida se pelo menos um campo foi enviado
  if (!situacao && !data_transacao) {
    return res.status(400).json({ 
      error: "É necessário enviar pelo menos um campo: situacao ou data_transacao." 
    });
  }

  try {
    let query = "UPDATE transacoes SET ";
    const params = [];
    const updates = [];

    // Constrói a query dinamicamente baseado nos campos enviados
    if (situacao !== undefined) {
      updates.push("situacao = ?");
      params.push(situacao);
    }

    if (data_transacao !== undefined) {
      updates.push("data_transacao = ?");
      params.push(data_transacao);
    }

    query += updates.join(", ") + " WHERE id = ?";
    params.push(id);

    const [result] = await pool.query(query, params);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Transação não encontrada." });
    }

    res.json({ 
      message: "Transação atualizada com sucesso.",
      updatedFields: {
        ...(situacao !== undefined && { situacao }),
        ...(data_transacao !== undefined && { data_transacao })
      }
    });
  } catch (error) {
    console.error("Erro ao atualizar transação:", error);
    res.status(500).json({ error: "Erro ao atualizar transação." });
  }
});

// 🔹 Atualizar apenas a situação
router.put("/:id/situacao", verifyToken, async (req, res) => {
  const { id } = req.params;
  const { situacao } = req.body;

  if (!situacao) {
    return res.status(400).json({ error: "Situação é obrigatória." });
  }

  try {
    const [result] = await pool.query(
      "UPDATE transacoes SET situacao = ? WHERE id = ?",
      [situacao, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Transação não encontrada." });
    }

    res.json({ message: "Situação atualizada com sucesso." });
  } catch (error) {
    console.error("Erro ao atualizar situação:", error);
    res.status(500).json({ error: "Erro ao atualizar situação." });
  }
});

// 🔹 Atualizar valor com base em PDF de boleto
router.put("/:id/valor-pdf", verifyToken, async (req, res) => {
  const { id } = req.params;
  const { anexo_base64 } = req.body;

  if (!anexo_base64) {
    return res.status(400).json({ error: "PDF é obrigatório para extrair o valor." });
  }

  try {
    // Buscar valor atual da transação
    const [transacao] = await pool.query(
      "SELECT valor FROM transacoes WHERE id = ?",
      [id]
    );

    if (transacao.length === 0) {
      return res.status(404).json({ error: "Transação não encontrada." });
    }

    const valorAtual = transacao[0].valor;

    // Processar PDF
    console.log('[DEBUG] Processando PDF para extrair valor da transação:', id);
    
    try {
      // Converter base64 para buffer
      const pdfBuffer = Buffer.from(anexo_base64, 'base64');
      
      // Extrair valor do PDF
      const valorExtraido = await extractBoletoValueFromPDF(pdfBuffer);
      
      if (!valorExtraido) {
        return res.status(400).json({ 
          error: "Não foi possível extrair valor do PDF enviado.",
          valor_atual: valorAtual
        });
      }

      // Atualizar valor na transação
      const [result] = await pool.query(
        "UPDATE transacoes SET valor = ? WHERE id = ?",
        [valorExtraido, id]
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({ error: "Transação não encontrada." });
      }

      console.log(`[DEBUG] Valor atualizado da transação ${id}: R$ ${valorAtual} → R$ ${valorExtraido}`);

      res.json({ 
        message: "Valor atualizado com sucesso a partir do PDF.",
        valor_original: valorAtual,
        valor_novo: valorExtraido,
        valor_extraido_pdf: true
      });

    } catch (pdfError) {
      console.error('[ERROR] Erro ao processar PDF:', pdfError);
      res.status(500).json({ 
        error: "Erro ao processar PDF.",
        valor_atual: valorAtual
      });
    }

  } catch (error) {
    console.error("Erro ao atualizar valor com PDF:", error);
    res.status(500).json({ error: "Erro ao atualizar valor com PDF." });
  }
});

// 🔹 Relatório de categorias com subcategorias e valores agregados
router.get("/relatorio/categorias/:companyId", verifyToken, async (req, res) => {
  const { companyId } = req.params;
  const { mes, ano, tipo, dia, conta_id, conta_api_id } = req.query; // Filtros opcionais

  try {
    const params = [companyId];

    // Adicionar filtros opcionais aos parâmetros
    if (mes && ano && dia) {
      // Filtro por mês, ano e dia específico
      params.push(mes, ano, dia);
    } else if (mes && ano) {
      // Filtro por mês e ano (sem dia)
      params.push(mes, ano);
    } else if (ano) {
      // Filtro apenas por ano
      params.push(ano);
    }

    if (tipo && (tipo === 'entrada' || tipo === 'saida')) {
      params.push(tipo);
    }

    if (conta_id) {
      params.push(conta_id, companyId); // conta_id + company_id para validação
    }

    if (conta_api_id) {
      params.push(conta_api_id, companyId); // conta_api_id + company_id para validação
    }

    const [rows] = await pool.query(
      `
      SELECT 
        c.id AS categoria_id,
        c.nome AS categoria_nome,
        sc.id AS subcategoria_id,
        sc.nome AS subcategoria_nome,
        tp.id AS tipo_id,
        tp.nome AS tipo_nome,
        
        -- 📊 VALORES PREVISTOS (todos os registros)
        COALESCE(SUM(t.valor), 0) AS valor_previsto,
        COUNT(t.id) AS total_transacoes_previsto,
        
        -- 📊 VALORES REALIZADOS (situacao = 'recebido', 'pago' ou 'conciliado')
        COALESCE(SUM(
          CASE 
            WHEN t.situacao IN ('recebido', 'pago', 'conciliado') THEN t.valor 
            ELSE 0 
          END
        ), 0) AS valor_realizado,
        
        COUNT(
          CASE 
            WHEN t.situacao IN ('recebido', 'pago', 'conciliado') THEN t.id 
            ELSE NULL 
          END
        ) AS total_transacoes_realizado,
        
        -- 📊 VALORES PENDENTES (situacao diferente de 'recebido', 'pago' e 'conciliado')
        COALESCE(SUM(
          CASE 
            WHEN t.situacao NOT IN ('recebido', 'pago', 'conciliado') THEN t.valor 
            ELSE 0 
          END
        ), 0) AS valor_pendente,
        
        COUNT(
          CASE 
            WHEN t.situacao NOT IN ('recebido', 'pago', 'conciliado') THEN t.id 
            ELSE NULL 
          END
        ) AS total_transacoes_pendente,
        
        -- 📊 INFORMAÇÕES ADICIONAIS
        t.tipo AS transacao_tipo,
        GROUP_CONCAT(DISTINCT t.situacao) AS situacoes_encontradas
        
      FROM tipos tp
      INNER JOIN categorias c ON c.tipo_id = tp.id
      LEFT JOIN sub_categorias sc ON sc.categoria_id = c.id
      LEFT JOIN transacoes t ON t.categoria_id = c.id AND t.sub_categoria_id = sc.id AND t.company_id = tp.company_id
      WHERE tp.company_id = ?
      ${mes && ano && dia ? ' AND MONTH(t.data_vencimento) = ? AND YEAR(t.data_vencimento) = ? AND DAY(t.data_vencimento) = ?' : ''}
      ${mes && ano && !dia ? ' AND MONTH(t.data_vencimento) = ? AND YEAR(t.data_vencimento) = ?' : ''}
      ${ano && !mes ? ' AND YEAR(t.data_vencimento) = ?' : ''}
      ${tipo && (tipo === 'entrada' || tipo === 'saida') ? ' AND t.tipo = ?' : ''}
      ${conta_id ? ' AND t.conta_id = ? AND EXISTS(SELECT 1 FROM contas WHERE id = t.conta_id AND company_id = ?)' : ''}
      ${conta_api_id ? ' AND t.conta_api_id = ? AND EXISTS(SELECT 1 FROM contas_api WHERE id = t.conta_api_id AND company_id = ?)' : ''}
      GROUP BY tp.id, tp.nome, c.id, c.nome, sc.id, sc.nome, t.tipo
      HAVING valor_previsto > 0 OR valor_realizado > 0 OR sc.id IS NOT NULL
      ORDER BY tp.nome, c.nome, sc.nome
      `,
      params
    );

    // 🔹 Organizar dados por tipo → categoria → subcategoria
    const resultado = {};
    
    rows.forEach(row => {
      const tipoId = row.tipo_id;
      const categoriaId = row.categoria_id;
      
      // Inicializar tipo se não existir
      if (!resultado[tipoId]) {
        resultado[tipoId] = {
          tipo_id: tipoId,
          tipo_nome: row.tipo_nome,
          total_tipo_previsto: 0,
          total_tipo_realizado: 0,
          total_tipo_pendente: 0,
          categorias: {}
        };
      }
      
      // Inicializar categoria se não existir
      if (!resultado[tipoId].categorias[categoriaId]) {
        resultado[tipoId].categorias[categoriaId] = {
          categoria_id: categoriaId,
          categoria_nome: row.categoria_nome,
          total_categoria_previsto: 0,
          total_categoria_realizado: 0,
          total_categoria_pendente: 0,
          subcategorias: []
        };
      }
      
      // Adicionar subcategoria
      if (row.subcategoria_id) {
        const valorPrevisto = parseFloat(row.valor_previsto || 0);
        const valorRealizado = parseFloat(row.valor_realizado || 0);
        const valorPendente = parseFloat(row.valor_pendente || 0);
        
        const subcategoria = {
          subcategoria_id: row.subcategoria_id,
          subcategoria_nome: row.subcategoria_nome,
          valor_previsto: valorPrevisto,
          valor_realizado: valorRealizado,
          valor_pendente: valorPendente,
          total_transacoes_previsto: row.total_transacoes_previsto || 0,
          total_transacoes_realizado: row.total_transacoes_realizado || 0,
          total_transacoes_pendente: row.total_transacoes_pendente || 0,
          transacao_tipo: row.transacao_tipo,
          situacoes_encontradas: row.situacoes_encontradas ? row.situacoes_encontradas.split(',') : []
        };
        
        resultado[tipoId].categorias[categoriaId].subcategorias.push(subcategoria);
        
        // Somar aos totais da categoria
        resultado[tipoId].categorias[categoriaId].total_categoria_previsto += valorPrevisto;
        resultado[tipoId].categorias[categoriaId].total_categoria_realizado += valorRealizado;
        resultado[tipoId].categorias[categoriaId].total_categoria_pendente += valorPendente;
        
        // Somar aos totais do tipo
        resultado[tipoId].total_tipo_previsto += valorPrevisto;
        resultado[tipoId].total_tipo_realizado += valorRealizado;
        resultado[tipoId].total_tipo_pendente += valorPendente;
      }
    });

    // Converter estrutura aninhada em array
    const relatorio = Object.values(resultado).map(tipo => ({
      ...tipo,
      categorias: Object.values(tipo.categorias)
    }));

    // 📊 Calcular totais gerais
    const totaisGerais = {
      total_geral_previsto: relatorio.reduce((sum, tipo) => sum + tipo.total_tipo_previsto, 0),
      total_geral_realizado: relatorio.reduce((sum, tipo) => sum + tipo.total_tipo_realizado, 0),
      total_geral_pendente: relatorio.reduce((sum, tipo) => sum + tipo.total_tipo_pendente, 0),
      total_tipos: relatorio.length,
      total_categorias: relatorio.reduce((sum, tipo) => sum + tipo.categorias.length, 0),
      total_subcategorias: relatorio.reduce((sum, tipo) => 
        sum + tipo.categorias.reduce((catSum, cat) => catSum + cat.subcategorias.length, 0), 0)
    };

    res.json({
      filtros_aplicados: {
        company_id: companyId,
        mes: mes || null,
        ano: ano || null,
        tipo: tipo || 'todos',
        conta_id: conta_id || null,
        conta_api_id: conta_api_id || null
      },
      totais_gerais: totaisGerais,
      tipos: relatorio
    });

  } catch (error) {
    console.error("Erro ao gerar relatório de categorias:", error);
    res.status(500).json({ error: "Erro ao gerar relatório de categorias." });
  }
});

// 🔹 Deletar transação
router.delete("/:id", verifyToken, async (req, res) => {
  const { id } = req.params;

  try {
    const [result] = await pool.query("DELETE FROM transacoes WHERE id = ?", [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Transação não encontrada." });
    }

    res.json({ message: "Transação deletada com sucesso." });
  } catch (error) {
    console.error("Erro ao deletar transação:", error);
    res.status(500).json({ error: "Erro ao deletar transação." });
  }
});


//PDF DE BOLETOS
// 🔹 Buscar codigo_solicitacao do boleto a partir do ID da transação e o access_token do Inter
router.get("/:id/codigo-solicitacao", verifyToken, async (req, res) => {
  const { id } = req.params;

  try {
    // 1 Busca o boleto_id da transação
    const [transacao] = await pool.query("SELECT boleto_id FROM transacoes WHERE id = ?", [id]);

    if (transacao.length === 0) {
      return res.status(404).json({ error: "Transação não encontrada." });
    }

    const boletoId = transacao[0].boleto_id;

    if (!boletoId) {
      return res.status(404).json({ error: "Esta transação não possui boleto vinculado." });
    }

    // 2️ Busca o codigo_solicitacao na tabela boletos
    const [boleto] = await pool.query("SELECT codigo_solicitacao FROM boletos WHERE id = ?", [boletoId]);

    if (boleto.length === 0) {
      return res.status(404).json({ error: "Boleto não encontrado." });
    }

    // 3️ Busca o access_token mais recente do Inter
    const [[tokenRow]] = await pool.query(
      "SELECT access_token FROM inter_tokens ORDER BY created_at DESC LIMIT 1"
    );

    if (!tokenRow || !tokenRow.access_token) {
      return res.status(400).json({ error: "Token de acesso do Inter não encontrado. Gere um token primeiro." });
    }

    // 4️ Retorna codigo_solicitacao + token
    res.json({
      codigo_solicitacao: boleto[0].codigo_solicitacao,
      access_token: tokenRow.access_token
    });

  } catch (error) {
    console.error("Erro ao buscar codigo_solicitacao:", error);
    res.status(500).json({ error: "Erro interno ao buscar codigo_solicitacao." });
  }
});


module.exports = router;
