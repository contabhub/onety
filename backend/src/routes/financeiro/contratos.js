const express = require("express");
const router = express.Router();
const pool = require("../../config/database");
const verifyToken = require("../../middlewares/auth");

// ✅ CREATE - Criar novo contrato
router.post("/", verifyToken, async (req, res) => {
  try {
    const {
      centro_custo_id,
      observacoes_fiscais,
      numero_contrato,
      cliente_id,
      produtos_servicos, // ✅ Novo: array de produtos/serviços
      produto_id, // ✅ Mantido para compatibilidade
      empresa_id,
      categoria_id,
      subcategoria_id,
      conta_id,
      conta_api_id,

      valor, // ✅ Mantido para compatibilidade (valor total)
      desconto, // ✅ Mantido para compatibilidade (desconto total)
      valor_recorrente, // ✅ Valor recorrente do contrato
      data_inicio,
      dia_gerado,
      proximo_vencimento,
      status,
      observacoes
    } = req.body;

    // ✅ Validação: aceita tanto array quanto campo único para compatibilidade
    if (!cliente_id || !empresa_id || !data_inicio) {
      return res.status(400).json({ error: "Campos obrigatórios: cliente_id, empresa_id, data_inicio" });
    }

    // ✅ Validação: deve ter pelo menos um produto/serviço
    if (!produtos_servicos && !produto_id) {
      return res.status(400).json({ error: "Deve informar pelo menos um produto/serviço" });
    }

    // ✅ Calcular valor total se não fornecido
    let valorTotal = valor || 0;
    let descontoTotal = desconto || 0;

    // ✅ Se produtos_servicos for array, calcular valores
    if (produtos_servicos && Array.isArray(produtos_servicos)) {
      valorTotal = produtos_servicos.reduce((total, item) => {
        const itemValor = (item.quantidade || 1) * (item.valor_unitario || 0);
        const itemDesconto = item.desconto || 0;
        return total + itemValor - itemDesconto;
      }, 0);
      
      descontoTotal = produtos_servicos.reduce((total, item) => total + (item.desconto || 0), 0);
    }

    // ✅ Iniciar transação
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // ✅ 1. Criar contrato principal
      const [contratoResult] = await connection.query(
        `INSERT INTO contratos 
          (cliente_id, centro_custo_id, produto_id, empresa_id, categoria_id, subcategoria_id, 
           caixinha_id, conta_api_id, valor, desconto, comeca_em, status, observacoes, 
           produtos_dados, valor_recorrente) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          cliente_id, centro_custo_id || null, 
          produto_id || null, empresa_id, 
          categoria_id || null, subcategoria_id || null, 
          conta_id || null, // Mapeado para caixinha_id
          conta_api_id || null, 
          valorTotal, descontoTotal, 
          data_inicio, // Mapeado para comeca_em
          status || 'pendente', observacoes || null,
          JSON.stringify(produtos_servicos) || null,
          valor_recorrente || 0
        ]
      );

      const contratoId = contratoResult.insertId;

      // ✅ 2. Se produtos_servicos for array, criar registros na tabela pivô
      if (produtos_servicos && Array.isArray(produtos_servicos)) {
        for (const produto of produtos_servicos) {
          if (produto.produto_id && produto.valor_unitario) {
            await connection.query(
              `INSERT INTO contrato_produto 
                (contrato_id, produto_id, departamento_id, quantidade, valor_unitario, desconto, observacoes) 
               VALUES (?, ?, ?, ?, ?, ?, ?)`,
              [
                contratoId,
                produto.produto_id,
                produto.departamento_id || null,
                produto.quantidade || 1,
                produto.valor_unitario,
                produto.desconto || 0,
                produto.observacoes || null
              ]
            );
          }
        }
      }
      // ✅ 3. Se apenas produto_id foi fornecido, criar registro único na tabela pivô
      else if (produto_id) {
        await connection.query(
          `INSERT INTO contrato_produto 
            (contrato_id, produto_id, departamento_id, quantidade, valor_unitario, desconto, observacoes) 
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            contratoId,
            produto_id,
            null, // Sem departamento padrão para modo compatibilidade
            1, // Quantidade padrão
            valorTotal, // Valor total vira valor unitário
            descontoTotal, // Desconto total
            observacoes || null
          ]
        );
      }

      // ✅ 4. Gerar vendas automaticamente para o ano atual
      try {
        const dataInicio = new Date(data_inicio);
        const anoAtual = dataInicio.getFullYear();
        
        // Buscar configuração de recorrência (se existir)
        const [recorrenciaConfig] = await connection.query(
          `SELECT * FROM recorrencias_vendas WHERE contrato_id = ? LIMIT 1`,
          [contratoId]
        );

        // Se não tem configuração, criar uma padrão
        if (recorrenciaConfig.length === 0) {
          await connection.query(
            `INSERT INTO recorrencias_vendas 
              (contrato_id, tipo_intervalo, intervalo, indeterminado, status, tipo_origem) 
             VALUES (?, ?, ?, ?, ?, ?)`,
            [contratoId, 'meses', 1, 1, 'ativo', 'contrato'] // 1 mês, indeterminado, ativo
          );
        }

        // Gerar vendas para os 12 meses do ano atual
        for (let mes = 0; mes < 12; mes++) {
          const dataVencimento = new Date(anoAtual, mes, dataInicio.getDate());
          
          // Pular se a data já passou (para contratos criados no meio do ano)
          if (dataVencimento < new Date()) {
            continue;
          }

          await connection.query(`
            INSERT INTO vendas (
              cliente_id, empresa_id, valor_venda, vencimento, situacao, tipo_venda,
              observacoes, contrato_id, mes_referencia, ano_referencia,
              categoria_id, subcategoria_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            cliente_id, empresa_id, valorTotal, 
            dataVencimento.toISOString().split('T')[0], 'pendente', 'recorrente',
            `Contrato ${contratoId} - ${mes + 1}º período de ${anoAtual}`, 
            contratoId, mes + 1, anoAtual,
            categoria_id, subcategoria_id
          ]);

          // Criar registro de recorrência para esta venda
          const [vendaResult] = await connection.query(
            `SELECT id FROM vendas WHERE contrato_id = ? AND mes_referencia = ? AND ano_referencia = ?`,
            [contratoId, mes + 1, anoAtual]
          );

          if (vendaResult.length > 0) {
            await connection.query(
              `INSERT INTO recorrencias_vendas 
                (contrato_id, venda_id, tipo_intervalo, intervalo, indeterminado, status, tipo_origem) 
               VALUES (?, ?, ?, ?, ?, ?, ?)`,
              [contratoId, vendaResult[0].id, 'meses', 1, 1, 'ativo', 'venda']
            );
          }
        }

        console.log(`✅ Vendas geradas automaticamente para contrato ${contratoId} - ano ${anoAtual}`);
      } catch (vendasError) {
        console.error("⚠️ Erro ao gerar vendas automáticas:", vendasError);
        // Não falha a criação do contrato se der erro nas vendas
      }

      await connection.commit();
      connection.release();

      res.status(201).json({ 
        message: "Contrato criado com sucesso e vendas geradas automaticamente!", 
        id: contratoId,
        valor_total: valorTotal,
        desconto_total: descontoTotal
      });

    } catch (error) {
      await connection.rollback();
      connection.release();
      throw error;
    }

  } catch (error) {
    console.error("❌ Erro ao criar contrato:", error);
    res.status(500).json({ error: "Erro ao criar contrato." });
  }
});

router.get("/form-data", verifyToken, async (req, res) => {
  try {
    const { empresa_id } = req.query;

    if (!empresa_id) {
      return res.status(400).json({ message: "O parâmetro empresa_id é obrigatório." });
    }

    // tabelas que têm empresa_id diretamente
    const [clientes] = await pool.query("SELECT id, nome_fantasia FROM clientes WHERE empresa_id = ?", [empresa_id]);
    const [produtosServicos] = await pool.query("SELECT id, nome FROM produtos WHERE empresa_id = ?", [empresa_id]);
    const [companies] = await pool.query("SELECT id, nome FROM empresas WHERE id = ?", [empresa_id]);
    const [centrosCusto] = await pool.query("SELECT id, nome FROM centro_custo WHERE empresa_id = ?", [empresa_id]);
    const [departamentos] = await pool.query("SELECT id, nome, codigo FROM departamentos WHERE empresa_id = ? AND status = 'ativo'", [empresa_id]);

    // categorias e subcategorias via tipos
    const [categorias] = await pool.query(
      `SELECT c.id, c.nome 
       FROM straton_categorias c
       INNER JOIN tipos t ON c.tipo_id = t.id
       WHERE t.empresa_id = ?`,
      [empresa_id]
    );

    const [subCategorias] = await pool.query(
      `SELECT sc.id, sc.nome 
       FROM straton_subcategorias sc
       INNER JOIN straton_categorias c ON sc.categoria_id = c.id
       INNER JOIN tipos t ON c.tipo_id = t.id
       WHERE t.empresa_id = ?`,
      [empresa_id]
    );

    // usuários filtrados pela tabela pivô user_company
    const [users] = await pool.query(
      `SELECT u.id, u.nome 
       FROM usuarios u
       INNER JOIN user_company uc ON uc.user_id = u.id
       WHERE uc.company_id = ?`,
      [empresa_id]
    );

    // retorna tudo pronto pro frontend
    res.json({
      clientes,
      produtosServicos,
      companies,
      centrosCusto,
      departamentos,
      users,
      categorias,
      subCategorias
    });

  } catch (error) {
    console.error("❌ Erro ao buscar dados para o form:", error);
    res.status(500).json({ message: "Erro ao buscar dados do formulário", error });
  }
});

// ✅ READ - Listar todos os contratos (com filtro opcional por empresa)
router.get("/", verifyToken, async (req, res) => {
  try {
    const { empresa_id } = req.query;
    
    let query = `
      SELECT 
        c.*, 
        co.nome AS empresa_nome,
        cc.nome AS centro_custo_nome
      FROM contratos c
      LEFT JOIN empresas co ON c.empresa_id = co.id
      LEFT JOIN centro_custo cc ON c.centro_custo_id = cc.id
    `;

    let params = [];
    if (empresa_id) {
      query += " WHERE c.empresa_id = ?";
      params.push(empresa_id);
    }

    query += " ORDER BY c.criado_em DESC";

    const [contratos] = await pool.query(query, params);
    
    // ✅ Buscar produtos relacionados para cada contrato
    const contratosComProdutos = await Promise.all(
      contratos.map(async (contrato) => {
        const [produtos] = await pool.query(
          `SELECT 
            cps.*,
            ps.nome as produto_nome,
            ps.tipo as produto_tipo,
            d.nome as departamento_nome
           FROM contrato_produto cps
           INNER JOIN produtos ps ON cps.produto_id = ps.id
           LEFT JOIN departamentos d ON cps.departamento_id = d.id
           WHERE cps.contrato_id = ?`,
          [contrato.id]
        );
        
        return {
          ...contrato,
          produtos: produtos
        };
      })
    );

    res.json(contratosComProdutos);
  } catch (error) {
    console.error("❌ Erro ao listar contratos:", error);
    res.status(500).json({ error: "Erro ao listar contratos." });
  }
});

// ✅ READ ONE - Buscar contrato específico
router.get("/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    const query = `
      SELECT 
        c.*, 
        co.nome AS empresa_nome,
        cc.nome AS centro_custo_nome
      FROM contratos c
      LEFT JOIN empresas co ON c.empresa_id = co.id
      LEFT JOIN centro_custo cc ON c.centro_custo_id = cc.id
      WHERE c.id = ?
    `;

    const [contratos] = await pool.query(query, [id]);

    if (contratos.length === 0) {
      return res.status(404).json({ error: "Contrato não encontrado." });
    }

    const contrato = contratos[0];

    // ✅ Buscar produtos relacionados
    const [produtos] = await pool.query(
      `SELECT 
        cps.*,
        ps.nome as produto_nome,
        ps.tipo as produto_tipo,
        d.nome as departamento_nome
       FROM contrato_produto cps
       INNER JOIN produtos ps ON cps.produto_id = ps.id
       LEFT JOIN departamentos d ON cps.departamento_id = d.id
       WHERE cps.contrato_id = ?`,
      [id]
    );

    // ✅ Retornar contrato com produtos
    res.json({
      ...contrato,
      produtos: produtos
    });

  } catch (error) {
    console.error("❌ Erro ao buscar contrato:", error);
    res.status(500).json({ error: "Erro ao buscar contrato." });
  }
});

// ✅ UPDATE - Atualizar contrato
router.put("/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // ✅ Iniciar transação
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // ✅ 1. Atualizar contrato principal
      const fields = [];
      const values = [];

      // Campos que podem ser atualizados no contrato
      const allowedFields = [
        'centro_custo_id',
        'observacoes_fiscais',
        'valor',
        'desconto',
        'proximo_vencimento',
        'observacoes',
        'categoria_id',
        'subcategoria_id',
        'conta_id',
        'conta_api_id'
      ];

      // Adicionar apenas campos que foram enviados
      allowedFields.forEach(field => {
        if (updateData.hasOwnProperty(field)) {
          fields.push(`${field}=?`);
          values.push(updateData[field]);
        }
      });

      // Adicionar updated_at
      fields.push('atualizado_em=NOW()');

      if (fields.length > 0) {
        // Adicionar o ID no final
        values.push(id);

        const query = `UPDATE contratos SET ${fields.join(', ')} WHERE id=?`;
        console.log('Query contrato:', query);
        console.log('Values contrato:', values);

        const [result] = await connection.query(query, values);

        if (result.affectedRows === 0) {
          throw new Error("Contrato não encontrado.");
        }
      }

      // ✅ 2. Atualizar produtos se enviados
      if (updateData.produtos && Array.isArray(updateData.produtos)) {
        // Remover produtos existentes
        await connection.query('DELETE FROM contrato_produto WHERE contrato_id = ?', [id]);

        // Inserir novos produtos
        for (const produto of updateData.produtos) {
          if (produto.produto_id && produto.valor_unitario) {
            await connection.query(
              `INSERT INTO contrato_produto 
                (contrato_id, produto_id, departamento_id, quantidade, valor_unitario, desconto, observacoes) 
               VALUES (?, ?, ?, ?, ?, ?, ?)`,
              [
                id,
                produto.produto_id,
                produto.departamento_id || null,
                produto.quantidade || 1,
                produto.valor_unitario,
                produto.desconto || 0,
                produto.observacoes || null
              ]
            );
          }
        }

        // ✅ 3. Recalcular valor total do contrato
        const [produtosResult] = await connection.query(
          `SELECT 
            SUM(quantidade * valor_unitario) as valor_total,
            SUM(desconto) as desconto_total
           FROM contrato_produto 
           WHERE contrato_id = ?`,
          [id]
        );

        if (produtosResult.length > 0) {
          const valorTotal = produtosResult[0].valor_total || 0;
          const descontoTotal = produtosResult[0].desconto_total || 0;

          await connection.query(
            'UPDATE contratos SET valor = ?, desconto = ? WHERE id = ?',
            [valorTotal, descontoTotal, id]
          );
        }
      }

      await connection.commit();
      connection.release();

      res.json({ message: "Contrato atualizado com sucesso!" });

    } catch (error) {
      await connection.rollback();
      connection.release();
      throw error;
    }

  } catch (error) {
    console.error("❌ Erro ao atualizar contrato:", error);
    if (error.message === "Contrato não encontrado.") {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: "Erro ao atualizar contrato." });
  }
});

// ✅ DELETE - Remover contrato
router.delete("/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const [result] = await pool.query("DELETE FROM contratos WHERE id = ?", [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Contrato não encontrado." });
    }

    res.json({ message: "Contrato deletado com sucesso!" });
  } catch (error) {
    console.error("❌ Erro ao deletar contrato:", error);
    res.status(500).json({ error: "Erro ao deletar contrato." });
  }
});

// ✅ GERENCIAR PRODUTOS - Adicionar produto ao contrato
router.post("/:id/produtos", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { produto_id, departamento_id, quantidade, valor_unitario, desconto, observacoes } = req.body;

    if (!produto_id || !valor_unitario) {
      return res.status(400).json({ error: "Campos obrigatórios: produto_id, valor_unitario" });
    }

    // ✅ Verificar se o contrato existe
    const [contrato] = await pool.query("SELECT id FROM contratos WHERE id = ?", [id]);
    if (contrato.length === 0) {
      return res.status(404).json({ error: "Contrato não encontrado." });
    }

    // ✅ Verificar se o produto já existe no contrato
    const [produtoExistente] = await pool.query(
      "SELECT id FROM contrato_produto WHERE contrato_id = ? AND produto_id = ?",
      [id, produto_id]
    );

    if (produtoExistente.length > 0) {
      return res.status(400).json({ error: "Este produto já está cadastrado no contrato." });
    }

    // ✅ Inserir novo produto
    const [result] = await pool.query(
      `INSERT INTO contrato_produto 
        (contrato_id, produto_id, departamento_id, quantidade, valor_unitario, desconto, observacoes) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, produto_id, departamento_id || null, quantidade || 1, valor_unitario, desconto || 0, observacoes || null]
    );

    // ✅ Recalcular valor total do contrato
    const [produtosResult] = await pool.query(
      `SELECT 
        SUM(quantidade * valor_unitario) as valor_total,
        SUM(desconto) as desconto_total
       FROM contrato_produto 
       WHERE contrato_id = ?`,
      [id]
    );

    if (produtosResult.length > 0) {
      const valorTotal = produtosResult[0].valor_total || 0;
      const descontoTotal = produtosResult[0].desconto_total || 0;

      await pool.query(
        'UPDATE contratos SET valor = ?, desconto = ? WHERE id = ?',
        [valorTotal, descontoTotal, id]
      );
    }

    res.status(201).json({ 
      message: "Produto adicionado ao contrato com sucesso!", 
      id: result.insertId 
    });

  } catch (error) {
    console.error("❌ Erro ao adicionar produto ao contrato:", error);
    res.status(500).json({ error: "Erro ao adicionar produto ao contrato." });
  }
});

// ✅ ATUALIZAR PRODUTO ESPECÍFICO
router.put("/:id/produtos/:produto_id", verifyToken, async (req, res) => {
  try {
    const { id, produto_id } = req.params;
    const { departamento_id, quantidade, valor_unitario, desconto, observacoes } = req.body;

    if (!valor_unitario) {
      return res.status(400).json({ error: "Campo obrigatório: valor_unitario" });
    }

    // ✅ Verificar se o produto existe no contrato
    const [produto] = await pool.query(
      "SELECT id FROM contrato_produto WHERE id = ? AND contrato_id = ?",
      [produto_id, id]
    );

    if (produto.length === 0) {
      return res.status(404).json({ error: "Produto não encontrado no contrato." });
    }

    // ✅ Atualizar produto
    await pool.query(
      `UPDATE contrato_produto 
       SET departamento_id = ?, quantidade = ?, valor_unitario = ?, desconto = ?, observacoes = ?, atualizado_em = NOW()
       WHERE id = ?`,
      [departamento_id || null, quantidade || 1, valor_unitario, desconto || 0, observacoes || null, produto_id]
    );

    // ✅ Recalcular valor total do contrato
    const [produtosResult] = await pool.query(
      `SELECT 
        SUM(quantidade * valor_unitario) as valor_total,
        SUM(desconto) as desconto_total
       FROM contrato_produto 
       WHERE contrato_id = ?`,
      [id]
    );

    if (produtosResult.length > 0) {
      const valorTotal = produtosResult[0].valor_total || 0;
      const descontoTotal = produtosResult[0].desconto_total || 0;

      await pool.query(
        'UPDATE contratos SET valor = ?, desconto = ? WHERE id = ?',
        [valorTotal, descontoTotal, id]
      );
    }

    res.json({ message: "Produto atualizado com sucesso!" });

  } catch (error) {
    console.error("❌ Erro ao atualizar produto do contrato:", error);
    res.status(500).json({ error: "Erro ao atualizar produto do contrato." });
  }
});

// ✅ REMOVER PRODUTO DO CONTRATO
router.delete("/:id/produtos/:produto_id", verifyToken, async (req, res) => {
  try {
    const { id, produto_id } = req.params;

    // ✅ Verificar se o produto existe no contrato
    const [produto] = await pool.query(
      "SELECT id FROM contrato_produto WHERE id = ? AND contrato_id = ?",
      [produto_id, id]
    );

    if (produto.length === 0) {
      return res.status(404).json({ error: "Produto não encontrado no contrato." });
    }

    // ✅ Remover produto
    await pool.query(
      "DELETE FROM contrato_produto WHERE id = ? AND contrato_id = ?",
      [produto_id, id]
    );

    // ✅ Recalcular valor total do contrato
    const [produtosResult] = await pool.query(
      `SELECT 
        SUM(quantidade * valor_unitario) as valor_total,
        SUM(desconto) as desconto_total
       FROM contrato_produto 
       WHERE contrato_id = ?`,
      [id]
    );

    if (produtosResult.length > 0) {
      const valorTotal = produtosResult[0].valor_total || 0;
      const descontoTotal = produtosResult[0].desconto_total || 0;

      await pool.query(
        'UPDATE contratos SET valor = ?, desconto = ? WHERE id = ?',
        [valorTotal, descontoTotal, id]
      );
    }

    res.json({ message: "Produto removido do contrato com sucesso!" });

  } catch (error) {
    console.error("❌ Erro ao remover produto do contrato:", error);
    res.status(500).json({ error: "Erro ao remover produto do contrato." });
  }
});

// ✅ Atualiza SOMENTE o vencimento do contrato e marca se vale só para este mês
// ✅ Atualiza SOMENTE o vencimento do contrato e marca se vale só para este mês
router.patch("/:id/vencimento", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { proximo_vencimento, somente_proximo_vencimento } = req.body;

    // 🔍 LOG: Dados recebidos
    console.log("🔍 Backend - Dados recebidos:", {
      id,
      proximo_vencimento,
      somente_proximo_vencimento,
      tipo_somente: typeof somente_proximo_vencimento
    });

    // Validação: data é obrigatória neste endpoint
    if (typeof proximo_vencimento === "undefined") {
      return res.status(400).json({ error: "Informe 'proximo_vencimento' (YYYY-MM-DD)." });
    }
    if (proximo_vencimento !== null && isNaN(Date.parse(proximo_vencimento))) {
      return res.status(400).json({ error: "Formato inválido para 'proximo_vencimento'." });
    }

    // ✅ CORRIGIDO: Lógica mais clara para o boolean
    let onlyNext;
    if (typeof somente_proximo_vencimento === "undefined" || somente_proximo_vencimento === null) {
      onlyNext = 1; // Default: apenas próximo
    } else {
      onlyNext = somente_proximo_vencimento === true ? 1 : 0;
    }

    // 🔍 LOG: Valor que será salvo
    console.log("🔍 Backend - onlyNext calculado:", onlyNext, typeof onlyNext);

    // ✅ CORRIGIDO: Query com valores explícitos
    const query = `UPDATE contratos 
                   SET proximo_vencimento = ?, 
                       somente_proximo_vencimento = ?, 
                       atualizado_em = NOW() 
                   WHERE id = ?`;
    
    console.log("🔍 Backend - Query:", query);
    console.log("🔍 Backend - Parâmetros:", [proximo_vencimento, onlyNext, id]);

    const [result] = await pool.query(query, [proximo_vencimento, onlyNext, id]);

    // 🔍 LOG: Resultado do UPDATE
    console.log("🔍 Backend - Resultado UPDATE:", {
      affectedRows: result.affectedRows,
      changedRows: result.changedRows,
      info: result.info
    });

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Contrato não encontrado." });
    }

    // ✅ VERIFICAÇÃO: Buscar os dados após o update
    const [verificacao] = await pool.query(
      "SELECT id, proximo_vencimento, somente_proximo_vencimento FROM contratos WHERE id = ?",
      [id]
    );
    
    console.log("🔍 Backend - Dados após UPDATE:", verificacao[0]);

    return res.json({ 
      message: "Vencimento atualizado com sucesso.",
      dados_antes: { proximo_vencimento, somente_proximo_vencimento },
      dados_depois: verificacao[0]
    });

   } catch (err) {
     console.error("❌ Erro PATCH /contratos/:id/vencimento", err);
     return res.status(500).json({ error: "Erro ao atualizar o vencimento do contrato." });
   }
 });

// ✅ Gerar boleto automaticamente baseado no contrato e enviar por email
router.post("/:id/gerar-boleto", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    // Conta corrente será pega do numero_conta (contas) ou inter_conta_corrente (contas)

    // 🔍 1. Buscar dados completos do contrato + conta corrente
    const [contratos] = await pool.query(`
      SELECT 
        c.*,
        contas_origem.numero_conta as conta_corrente_contas,
        contas_api.inter_conta_corrente as conta_corrente_api
      FROM contratos c
      LEFT JOIN contas contas_origem ON c.conta_id = contas_origem.id
      LEFT JOIN contas contas_api ON c.conta_api_id = contas_api.id
      WHERE c.id = ?
    `, [id]);

    if (contratos.length === 0) {
      return res.status(404).json({ error: "Contrato não encontrado." });
    }

    const contrato = contratos[0];

    // 🔍 2. Validar se tem data de vencimento
    if (!contrato.proximo_vencimento) {
      return res.status(400).json({ error: "Contrato não possui data de vencimento definida." });
    }

    // 🔍 2.1. Validar se tem conta corrente (verifica tanto contas quanto contas)
    const contaCorrente = contrato.conta_corrente_contas || contrato.conta_corrente_api;
    if (!contaCorrente) {
      return res.status(400).json({ 
        error: "Contrato não possui conta corrente definida. Verifique se o conta_id está vinculado a uma conta válida.",
        debug: {
          conta_id: contrato.conta_id,
          conta_api_id: contrato.conta_api_id,
          conta_corrente_contas: contrato.conta_corrente_contas,
          conta_corrente_api: contrato.conta_corrente_api
        }
      });
    }

    // 🔍 3. Validar dados obrigatórios do cliente
    if (!contrato.email) {
      return res.status(400).json({ error: "Cliente não possui email cadastrado." });
    }
    if (!contrato.cpf_cnpj) {
      return res.status(400).json({ error: "Cliente não possui CPF/CNPJ cadastrado." });
    }

    // 🔍 4. Determinar tipo de pessoa baseado no campo tipo_de_pessoa ou no tamanho do documento
    let tipoPessoa = 'FISICA';
    if (contrato.tipo_pessoa) {
      // Se já tem o tipo definido na tabela, normalizar para API Inter
      const tipoNormalizado = contrato.tipo_pessoa.toUpperCase()
        .replace('FÍSICA', 'FISICA')
        .replace('JURÍDICA', 'JURIDICA');
      tipoPessoa = tipoNormalizado;
    } else {
      // Senão, determinar pelo tamanho do documento
      const documentoLimpo = contrato.cpf_cnpj.replace(/\D/g, '');
      tipoPessoa = documentoLimpo.length === 11 ? 'FISICA' : 'JURIDICA';
    }

    // 🔍 5. Gerar número único para o boleto
    let seuNumero = `CONTR${id}_${Date.now()}`;
    
    // Garantir que seuNumero tenha no máximo 15 caracteres
    if (seuNumero.length > 15) {
      seuNumero = seuNumero.slice(0, 15);
    }

    // 🔍 6. Preparar dados para criação do boleto (sem conta_corrente - será definida depois)
    
    // Converter data para formato YYYY-MM-DD (sem timestamp)
    const dataVencimento = new Date(contrato.proximo_vencimento).toISOString().split('T')[0];
    
    const dadosBoleto = {
      seuNumero: seuNumero,
      valorNominal: parseFloat(contrato.valor) || 0,
      dataVencimento: dataVencimento,
      numDiasAgenda: 30,
      pagador: {
        email: contrato.email,
        numero: contrato.numero || "S/N",
        complemento: contrato.complemento || "",
        cpfCnpj: contrato.cpf_cnpj.replace(/\D/g, ''), // Remove formatação
        tipoPessoa: tipoPessoa,
        nome: contrato.nome_fantasia,
        endereco: contrato.endereco || "Não informado",
        bairro: contrato.bairro || "Não informado", 
        cidade: contrato.cidade || "Não informado",
        uf: contrato.uf || "RJ",
        cep: contrato.cep ? contrato.cep.replace(/\D/g, '').padStart(8, '0') : "00000000"
      },
      formasRecebimento: ["BOLETO", "PIX"],
      mensagem: {
        linha1: "Obrigado pela preferência.",
        linha2: "Evite juros, pague até o vencimento."
      }
    };

    // 🔍 7. LOG para debug do contrato e conta
    console.log("🔍 DEBUG - Dados do contrato:", {
      id: contrato.id,
      conta_id: contrato.conta_id,
      conta_api_id: contrato.conta_api_id,
      conta_corrente_contas: contrato.conta_corrente_contas,
      conta_corrente_api: contrato.conta_corrente_api,
      conta_corrente_final: contaCorrente,
      cliente_id: contrato.cliente_id,
      valor: contrato.valor,
      tipo_pessoa_original: contrato.tipo_pessoa,
      tipo_pessoa_final: tipoPessoa,
      cpf_cnpj: contrato.cpf_cnpj
    });

    // 🔍 8. LOG dos dados que serão enviados
    console.log("🔍 Dados do boleto a serem criados:", JSON.stringify(dadosBoleto, null, 2));

    // 🎯 8. Criar boleto usando a API do Inter (mesma lógica do inter-boletos.js)
    const axios = require('axios');
    
    // Buscar conta Inter configurada para a empresa
    let empresaId = contrato.empresa_id;
    
    // Primeiro tentar buscar na tabela inter_accounts
    let [[contaInter]] = await pool.query(
      `SELECT * FROM inter_accounts 
       WHERE empresa_id = ? AND status = 'ativo' 
       ORDER BY is_default DESC, id ASC 
       LIMIT 1`,
      [empresaId]
    );

    // Se não encontrou, buscar na tabela contas
    if (!contaInter) {
      [[contaInter]] = await pool.query(
        `SELECT 
           id,
           empresa_id,
           inter_apelido as apelido,
           inter_conta_corrente as conta_corrente,
           inter_client_id as client_id,
           inter_client_secret as client_secret,
           inter_cert_b64 as cert_b64,
           inter_key_b64 as key_b64,
           inter_is_default as is_default,
           inter_status as status
         FROM contas 
         WHERE empresa_id = ? AND inter_ativado = TRUE AND inter_status = 'ativo'
         ORDER BY inter_is_default DESC, id ASC 
         LIMIT 1`,
        [empresaId]
      );
    }

    if (!contaInter) {
      return res.status(400).json({ error: `Nenhuma conta Inter configurada para a empresa ${empresaId}. Configure uma conta em /contas-api ou /inter-accounts.` });
    }

    console.log(`🏦 Usando conta Inter: ${contaInter.apelido || contaInter.conta_corrente}`);

    // Gerar token usando as credenciais da conta
    const automacao = require('../services/automacaoRecorrencia');
    const access_token = await automacao.gerarTokenInterComCredenciais(contaInter);

    // Configurar agente HTTPS com as credenciais da conta
    const cert = Buffer.from(contaInter.cert_b64, 'base64').toString('utf-8');
    const key = Buffer.from(contaInter.key_b64, 'base64').toString('utf-8');
    const https = require('https');
    const agent = new https.Agent({ cert, key });

    // URL base baseada no ambiente
    const baseUrl = contaInter.ambiente === 'hml' 
      ? 'https://cdp.partners.bancointer.com.br' 
      : 'https://cdpj.partners.bancointer.com.br';

    // Usar conta corrente da conta configurada (normalizada)
    const { normalizarContaCorrente } = require('../helpers/cnaeIbge');
    const contaCorrenteFinal = normalizarContaCorrente(contaInter.conta_corrente);

    // 🎯 9. Criar o boleto na API do Inter
    const interResponse = await axios.post(
      `${baseUrl}/cobranca/v3/cobrancas`,
      dadosBoleto,
      {
        headers: {
          "Authorization": `Bearer ${access_token}`,
          "x-conta-corrente": contaCorrenteFinal,
          "Content-Type": "application/json"
        },
        httpsAgent: agent,
      }
    );

    const boletoResult = interResponse.data;
    console.log("✅ Boleto criado na API Inter:", boletoResult);

    // 🎯 10. Salvar boleto no banco
    const { linkBoleto, codigoBarras, dataEmissao, dataVencimento: dataVenc, status, codigoSolicitacao } = boletoResult;
    const [boletoDbResult] = await pool.query(
      `INSERT INTO boletos 
        (link_boleto, codigo_barras, data_emissao, data_vencimento, status, seu_numero, valor_nominal, 
         pagador_nome, pagador_cpf_cnpj, pagador_email, codigo_solicitacao, inter_account_id, contrato_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        linkBoleto,
        codigoBarras,
        dataEmissao,
        dataVenc || contrato.proximo_vencimento,
        status,
        seuNumero,
        parseFloat(contrato.valor) || 0,
        contrato.nome_fantasia,
        contrato.cpf_cnpj,
        contrato.email,
        codigoSolicitacao || null,
        contaInter.id,
        id // contrato_id
      ]
    );

    const boletoId = boletoDbResult.insertId;

    // 📧 11. Aqui você pode enviar o email (opcional)
    /*
    await enviarEmailBoleto({
      email: contrato.email,
      nomeCliente: contrato.nome_fantasia,
      linkBoleto: linkBoleto,
      valorBoleto: contrato.valor,
      dataVencimento: contrato.proximo_vencimento
    });
    */

    // ✅ 12. Resposta de sucesso
    res.json({
      message: "Boleto criado e salvo com sucesso!",
      contrato_id: id,
      boleto_id: boletoId,
      cliente: contrato.nome_fantasia,
      email: contrato.email,
      valor: contrato.valor,
      vencimento: contrato.proximo_vencimento,
      conta_corrente: contaCorrenteFinal,
      boleto_criado: {
        ...boletoResult,
        insertId: boletoId
      }
    });

  } catch (error) {
    console.error("❌ Erro ao gerar boleto:", error);
    
    // Se for erro da API do Inter, mostrar detalhes específicos
    if (error.response?.data) {
      console.error("❌ Detalhes do erro Inter:", JSON.stringify(error.response.data, null, 2));
      return res.status(error.response.status || 500).json({
        error: "Erro na API do Inter",
        details: error.response.data,
        status: error.response.status
      });
    }
    
    res.status(500).json({ error: "Erro ao gerar boleto para o contrato." });
  }
});

// ✅ NOVA FUNCIONALIDADE: Gerar vendas futuras baseadas no contrato
router.post("/:id/gerar-vendas-futuras", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { quantidade_meses = 12, ano_referencia } = req.body;

    // 🔍 1. Buscar dados completos do contrato
    const [contratos] = await pool.query(`
      SELECT 
        c.*
      FROM contratos c
      WHERE c.id = ?
    `, [id]);

    if (contratos.length === 0) {
      return res.status(404).json({ error: "Contrato não encontrado." });
    }

    const contrato = contratos[0];

    // 🔍 2. Verificar se o contrato tem recorrência ativa
    const [recorrencia] = await pool.query(`
      SELECT * FROM recorrencias_vendas 
      WHERE contrato_id = ? AND tipo_origem = 'contrato' AND status = 'ativo'
    `, [id]);

    if (recorrencia.length === 0) {
      return res.status(400).json({ 
        error: "Contrato não possui recorrência ativa. Configure a recorrência primeiro." 
      });
    }

    const config = recorrencia[0];

    // 🔍 3. Calcular ano de referência
    const anoRef = ano_referencia || new Date().getFullYear();
    
    // 🔍 4. Verificar se já existem vendas para este ano
    const [vendasExistentes] = await pool.query(`
      SELECT COUNT(*) as total 
      FROM vendas 
      WHERE contrato_origem_id = ? AND ano_referencia = ?
    `, [id, anoRef]);

    if (vendasExistentes[0].total > 0) {
      return res.status(400).json({ 
        error: `Já existem ${vendasExistentes[0].total} vendas geradas para o contrato ${id} no ano ${anoRef}` 
      });
    }

    // 🔍 5. Calcular data base (próximo vencimento ou data início)
    let dataBase = contrato.proximo_vencimento || contrato.data_inicio;
    if (typeof dataBase === 'string') {
      dataBase = new Date(dataBase);
    }

    // Se a data base é de outro ano, ajustar para o ano de referência
    if (dataBase.getFullYear() !== anoRef) {
      dataBase = new Date(anoRef, dataBase.getMonth(), dataBase.getDate());
    }

    // 🔍 6. Gerar vendas futuras
    const vendasCriadas = [];
    const connection = await pool.getConnection();
    
    try {
      await connection.beginTransaction();

      for (let mes = 0; mes < quantidade_meses; mes++) {
        // Calcular data de vencimento para este mês
        let dataVencimento = new Date(dataBase);
        
        if (config.tipo_intervalo === 'meses') {
          dataVencimento.setMonth(dataBase.getMonth() + mes);
        } else if (config.tipo_intervalo === 'dias') {
          dataVencimento.setDate(dataBase.getDate() + (mes * (config.intervalo || 30)));
        } else if (config.tipo_intervalo === 'semanas') {
          dataVencimento.setDate(dataBase.getDate() + (mes * (config.intervalo || 4) * 7));
        }

        // Garantir que não passe para outro ano (exceto se for dezembro -> janeiro)
        if (dataVencimento.getFullYear() > anoRef && mes < quantidade_meses - 1) {
          dataVencimento.setFullYear(anoRef);
        }

        // Criar venda para este período
        const [vendaResult] = await connection.query(`
          INSERT INTO vendas (
            cliente_id, 
            empresa_id, 
            valor_venda, 
            vencimento, 
            situacao, 
            tipo_venda,
            observacoes,
            contrato_origem_id,
            mes_referencia,
            ano_referencia,
            categoria_id,
            subcategoria_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          contrato.cliente_id,
          contrato.empresa_id,
          contrato.valor,
          dataVencimento.toISOString().split('T')[0],
          'pendente',
          'recorrente',
          `Contrato ${id} - ${mes + 1}º período de ${anoRef}`,
          id, // contrato_origem_id
          mes + 1, // mes_referencia (1-12)
          anoRef, // ano_referencia
          contrato.categoria_id,
          contrato.subcategoria_id
        ]);

        // Criar recorrência específica para esta venda
        await connection.query(`
          INSERT INTO recorrencias_vendas (
            venda_id, 
            tipo_origem, 
            indeterminado, 
            status,
            tipo_intervalo,
            intervalo
          ) VALUES (?, ?, ?, ?, ?, ?)
        `, [
          vendaResult.insertId,
          'venda',
          0, // Não é indeterminado (é uma instância específica)
          'ativo',
          config.tipo_intervalo,
          config.intervalo
        ]);

        vendasCriadas.push({
          venda_id: vendaResult.insertId,
          mes_referencia: mes + 1,
          data_vencimento: dataVencimento.toISOString().split('T')[0],
          valor: contrato.valor
        });
      }

      await connection.commit();
      console.log(`✅ ${vendasCriadas.length} vendas futuras criadas para contrato ${id}`);

    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    // 🎯 7. Resposta de sucesso
    res.json({
      message: `${vendasCriadas.length} vendas futuras criadas com sucesso!`,
      contrato_id: id,
      ano_referencia: anoRef,
      quantidade_criada: vendasCriadas.length,
      vendas_criadas: vendasCriadas,
      resumo: {
        cliente: contrato.nome_fantasia,
        valor_mensal: contrato.valor,
        valor_total_ano: (parseFloat(contrato.valor) * vendasCriadas.length).toFixed(2),
        primeira_venda: vendasCriadas[0]?.data_vencimento,
        ultima_venda: vendasCriadas[vendasCriadas.length - 1]?.data_vencimento
      }
    });

  } catch (error) {
    console.error("❌ Erro ao gerar vendas futuras:", error);
    res.status(500).json({ error: "Erro ao gerar vendas futuras para o contrato." });
  }
});

// ✅ NOVA FUNCIONALIDADE: Visualizar cronograma futuro do contrato
router.get("/:id/cronograma-futuro", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { ano } = req.query;

    // 🔍 1. Buscar contrato
    const [contratos] = await pool.query(`
      SELECT c.* 
      FROM contratos c
      WHERE c.id = ?
    `, [id]);

    if (contratos.length === 0) {
      return res.status(404).json({ error: "Contrato não encontrado." });
    }

    // 🔍 2. Buscar vendas futuras do contrato
    let query = `
      SELECT 
        v.*,
        CASE 
          WHEN b.id IS NOT NULL THEN 'boleto_gerado'
          WHEN v.situacao = 'processado' THEN 'processado'
          WHEN v.vencimento <= CURDATE() THEN 'vencida'
          WHEN v.vencimento <= DATE_ADD(CURDATE(), INTERVAL 5 DAY) THEN 'proxima'
          ELSE 'futura'
        END as status_periodo,
        b.codigo_solicitacao,
        b.status as boleto_status,
        b.link_boleto
      FROM vendas v
      LEFT JOIN boletos b ON v.id = b.venda_id
      WHERE v.contrato_origem_id = ?
    `;

    const params = [id];
    
    if (ano) {
      query += ` AND v.ano_referencia = ?`;
      params.push(ano);
    }

    query += ` ORDER BY v.vencimento ASC`;

    const [vendas] = await pool.query(query, params);

    // 🔍 3. Agrupar por ano
    const vendasPorAno = {};
    let totalValor = 0;

    vendas.forEach(venda => {
      const anoRef = venda.ano_referencia;
      if (!vendasPorAno[anoRef]) {
        vendasPorAno[anoRef] = [];
      }
      vendasPorAno[anoRef].push(venda);
      totalValor += parseFloat(venda.valor_venda) || 0;
    });

    // 🎯 4. Resposta
    res.json({
      contrato: contratos[0],
      cronograma: vendasPorAno,
      resumo: {
        total_vendas: vendas.length,
        valor_total: totalValor.toFixed(2),
        anos_com_vendas: Object.keys(vendasPorAno),
        status_count: {
          boleto_gerado: vendas.filter(v => v.status_periodo === 'boleto_gerado').length,
          processado: vendas.filter(v => v.status_periodo === 'processado').length,
          vencida: vendas.filter(v => v.status_periodo === 'vencida').length,
          proxima: vendas.filter(v => v.status_periodo === 'proxima').length,
          futura: vendas.filter(v => v.status_periodo === 'futura').length
        }
      }
    });

  } catch (error) {
    console.error("❌ Erro ao buscar cronograma:", error);
    res.status(500).json({ error: "Erro ao buscar cronograma futuro." });
  }
});



module.exports = router;