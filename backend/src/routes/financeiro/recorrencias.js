const express = require("express");
const router = express.Router();
const pool = require("../../config/database");
const verifyToken = require("../../middlewares/auth");
const { gerarDatasParcelas } = require("../../services/financeiro/dateUtils");


// 🔹 Criar recorrência
// No seu arquivo de rotas de recorrências
// No seu arquivo de rotas de recorrências
router.post("/", verifyToken, async (req, res) => {
  const {
    frequencia,
    total_parcelas,
    indeterminada,
    intervalo_personalizado,
    tipo_intervalo,
    status,
    empresa_id,
    usar_template_existente, // ← NOVA FLAG (vem do frontend)
    recorrencia_template_id, // ← REFERÊNCIA AO TEMPLATE (vem do frontend)
    ...camposTransacao
  } = req.body;

  // Validações básicas
  if (indeterminada && total_parcelas) {
    return res.status(400).json({ error: "Recorrência indeterminada não deve ter total_parcelas." });
  }
  if (!empresa_id) {
    return res.status(400).json({ error: "empresa_id é obrigatório." });
  }

  try {
    let recorrenciaId;
    
    // CASO 1: Se é um template existente, NÃO cria nova recorrência
    if (usar_template_existente && recorrencia_template_id) {
      console.log("�� Usando template existente:", recorrencia_template_id);
      recorrenciaId = recorrencia_template_id;
      
      // Busca a configuração do template existente
      const [template] = await pool.query(
        "SELECT * FROM recorrencias WHERE id = ?", 
        [recorrencia_template_id]
      );
      
      if (template.length === 0) {
        return res.status(404).json({ error: "Template de recorrência não encontrado." });
      }
      
      // Usa os dados do template para gerar as transações
      const templateData = template[0];
      
      // Geração automática de transações usando template existente
      let transacoesCriadas = [];
      if (!templateData.indeterminada && templateData.total_parcelas && camposTransacao.data_vencimento) {
        const datas = gerarDatasParcelas(
          camposTransacao.data_vencimento,
          templateData.total_parcelas,
          templateData.intervalo_personalizado || 1,
          templateData.tipo_intervalo || 'meses'
        );
        
        for (let i = 0; i < datas.length; i++) {
        const payload = {
          ...camposTransacao,
          empresa_id,
          data_transacao: null,
          data_vencimento: datas[i],
          recorrencia_id: recorrenciaId
        };
        
        await pool.query(
          `INSERT INTO transacoes (
            conta_id, empresa_id, tipo, valor, descricao, data_transacao, origem,
            data_vencimento, situacao, observacao, parcelamento, intervalo_parcelas,
            categoria_id, subcategoria_id, cliente_id,
            anexo_base64, centro_custo_id, pluggy_transaction_id, recorrencia_id, criado_em
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
          [
            payload.conta_id,
            payload.empresa_id,
            payload.tipo,
            payload.valor,
            payload.descricao,
            payload.data_transacao,
            payload.origem,
            payload.data_vencimento,
            payload.situacao,
            payload.observacao,
            payload.parcelamento,
            payload.intervalo_parcelas,
            payload.categoria_id,
            payload.subcategoria_id || null,
            payload.cliente_id || null,
            payload.anexo_base64 || null,
            payload.centro_custo_id || null,
            payload.pluggy_transaction_id || null,
            payload.recorrencia_id
          ]
        );
          transacoesCriadas.push({ ...payload });
        }
      }

      res.status(201).json({
        template_usado: templateData,
        transacoes_geradas: transacoesCriadas,
        message: "Transações criadas usando template existente."
      });
      return;
    }

    // CASO 2: Criação normal de nova recorrência (código original)
    console.log("🆕 Criando nova recorrência");
    
    // Inserir na tabela recorrencias
    const [result] = await pool.query(
      `INSERT INTO recorrencias 
      (frequencia, total_parcelas, indeterminada, intervalo_personalizado, tipo_intervalo, status, empresa_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        frequencia,
        indeterminada ? null : total_parcelas,
        !!indeterminada,
        intervalo_personalizado || null,
        tipo_intervalo || null,
        status || 'ativo',
        empresa_id
      ]
    );

    recorrenciaId = result.insertId;

    // Geração automática de transações (código original)
    let transacoesCriadas = [];
    if (!indeterminada && total_parcelas && camposTransacao.data_vencimento) {
      const datas = gerarDatasParcelas(
        camposTransacao.data_vencimento,
        total_parcelas,
        intervalo_personalizado || 1,
        tipo_intervalo || 'meses'
      );
      
      for (let i = 0; i < datas.length; i++) {
        const payload = {
          ...camposTransacao,
          empresa_id,
          data_transacao: null,
          data_vencimento: datas[i],
          recorrencia_id: recorrenciaId
        };
        
        await pool.query(
          `INSERT INTO transacoes (
            conta_id, empresa_id, tipo, valor, descricao, data_transacao, origem,
            data_vencimento, situacao, observacao, parcelamento, intervalo_parcelas,
            categoria_id, subcategoria_id, cliente_id,
            anexo_base64, centro_custo_id, pluggy_transaction_id, recorrencia_id, criado_em
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
          [
            payload.conta_id,
            payload.empresa_id,
            payload.tipo,
            payload.valor,
            payload.descricao,
            payload.data_transacao,
            payload.origem,
            payload.data_vencimento,
            payload.situacao,
            payload.observacao,
            payload.parcelamento,
            payload.intervalo_parcelas,
            payload.categoria_id,
            payload.subcategoria_id || null,
            payload.cliente_id || null,
            payload.anexo_base64 || null,
            payload.centro_custo_id || null,
            payload.pluggy_transaction_id || null,
            payload.recorrencia_id
          ]
        );
        transacoesCriadas.push({ ...payload });
      }
    }

    res.status(201).json({
      recorrencia_id: recorrenciaId,
      transacoes_geradas: transacoesCriadas,
      message: "Recorrência e transações criadas com sucesso."
    });

  } catch (error) {
    console.error("Erro ao criar recorrência:", error);
    res.status(500).json({ error: "Erro ao criar recorrência.", details: error.message });
  }
});

// 🔹 Listar todas as recorrências
router.get("/", verifyToken, async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT * FROM recorrencias 
      ORDER BY criado_em DESC
    `);
    res.json(rows);
  } catch (error) {
    console.error("Erro ao listar recorrências:", error);
    res.status(500).json({ error: "Erro ao listar recorrências." });
  }
});

// 🔹 Buscar recorrência por ID
router.get("/:id", verifyToken, async (req, res) => {
  const { id } = req.params;

  try {
    const [rows] = await pool.query(
      "SELECT * FROM recorrencias WHERE id = ?",
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Recorrência não encontrada." });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error("Erro ao buscar recorrência:", error);
    res.status(500).json({ error: "Erro ao buscar recorrência." });
  }
});

// 🔹 Buscar recorrências por frequência
router.get("/frequencia/:frequencia", verifyToken, async (req, res) => {
  const { frequencia } = req.params;

  try {
    const [rows] = await pool.query(
      "SELECT * FROM recorrencias WHERE frequencia = ? ORDER BY criado_em DESC",
      [frequencia]
    );
    res.json(rows);
  } catch (error) {
    console.error("Erro ao buscar recorrências por frequência:", error);
    res.status(500).json({ error: "Erro ao buscar recorrências por frequência." });
  }
});

// 🔹 Atualizar recorrência
router.put("/:id", verifyToken, async (req, res) => {
  const { id } = req.params;
  const {
    frequencia,
    total_parcelas,
    indeterminada,
    intervalo_personalizado,
    tipo_intervalo,
    status,
    empresa_id
  } = req.body;

  if (indeterminada && total_parcelas) {
    return res.status(400).json({ error: "Recorrência indeterminada não deve ter total_parcelas." });
  }

  try {
    const [result] = await pool.query(
      `UPDATE recorrencias 
      SET frequencia = ?, total_parcelas = ?, indeterminada = ?, intervalo_personalizado = ?, tipo_intervalo = ?, status = ?, empresa_id = ?
      WHERE id = ?`,
      [
        frequencia,
        indeterminada ? null : total_parcelas,
        !!indeterminada,
        intervalo_personalizado || null,
        tipo_intervalo || null,
        status || 'ativo',
        empresa_id,
        id
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Recorrência não encontrada." });
    }

    const [rows] = await pool.query("SELECT * FROM recorrencias WHERE id = ?", [id]);

    res.json({
      ...rows[0],
      message: "Recorrência atualizada com sucesso."
    });
  } catch (error) {
    console.error("Erro ao atualizar recorrência:", error);
    res.status(500).json({ error: "Erro ao atualizar recorrência." });
  }
});

// 🔹 Atualizar apenas a situação (preenche data_transacao se pago/recebido)
router.put("/:id/situacao", verifyToken, async (req, res) => {
  const { id } = req.params;
  const { situacao, data_transacao } = req.body;

  if (!situacao) {
    return res.status(400).json({ error: "Situação é obrigatória." });
  }

  try {
    let query, params;
    // Agora inclui vencido e vencidos
    if (["pago", "recebido", "vencido", "vencidos"].includes(situacao.toLowerCase())) {
      if (data_transacao && /^\d{4}-\d{2}-\d{2}$/.test(data_transacao)) {
        query = "UPDATE transacoes SET situacao = ?, data_transacao = ? WHERE id = ?";
        params = [situacao, data_transacao, id];
      } else {
        query = "UPDATE transacoes SET situacao = ?, data_transacao = CURDATE() WHERE id = ?";
        params = [situacao, id];
      }
    } else {
      query = "UPDATE transacoes SET situacao = ? WHERE id = ?";
      params = [situacao, id];
    }

    console.log("Query:", query, "Params:", params);

    const [result] = await pool.query(query, params);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Transação não encontrada." });
    }

    res.json({ message: "Situação atualizada com sucesso." });
  } catch (error) {
    console.error("Erro ao atualizar situação:", error);
    res.status(500).json({ error: "Erro ao atualizar situação." });
  }
});

// 🔹 Deletar recorrência
router.delete("/:id", verifyToken, async (req, res) => {
  const { id } = req.params;

  try {
    const [transacoesVinculadas] = await pool.query(
      "SELECT COUNT(*) as total FROM transacoes WHERE recorrencia_id = ?",
      [id]
    );

    if (transacoesVinculadas[0].total > 0) {
      return res.status(400).json({
        error: "Não é possível deletar a recorrência. Existem transações vinculadas a ela."
      });
    }

    const [result] = await pool.query(
      "DELETE FROM recorrencias WHERE id = ?",
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Recorrência não encontrada." });
    }

    res.json({ message: "Recorrência deletada com sucesso." });
  } catch (error) {
    console.error("Erro ao deletar recorrência:", error);
    res.status(500).json({ error: "Erro ao deletar recorrência." });
  }
});

// 🔹 Buscar transações vinculadas a uma recorrência
router.get("/:id/transacoes", verifyToken, async (req, res) => {
  const { id } = req.params;

  try {
    const [rows] = await pool.query(`
      SELECT 
        t.*,
        c.nome AS categoria_nome,
        sc.nome AS subcategoria_nome,
        tp.nome AS tipo_nome,
        cl.nome_fantasia AS cliente_nome_fantasia,
        cc.codigo AS centro_custo_codigo,
        cc.nome AS centro_custo_nome
      FROM transacoes t
      LEFT JOIN straton_categorias c ON c.id = t.categoria_id
      LEFT JOIN straton_subcategorias sc ON sc.id = t.subcategoria_id
      LEFT JOIN tipos tp ON tp.id = c.tipo_id
      LEFT JOIN clientes cl ON cl.id = t.cliente_id
      LEFT JOIN centro_de_custo cc ON cc.id = t.centro_custo_id
      WHERE t.recorrencia_id = ?
      ORDER BY t.data_transacao ASC
    `, [id]);

    res.json(rows);
  } catch (error) {
    console.error("Erro ao buscar transações da recorrência:", error);
    res.status(500).json({ error: "Erro ao buscar transações da recorrência." });
  }
});

module.exports = router;
