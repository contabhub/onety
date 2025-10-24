const express = require("express");
const router = express.Router();
const pool = require("../../config/database");
const verifyToken = require("../../middlewares/auth");

// ✅ CREATE - Criar nova venda
router.post("/", verifyToken, async (req, res) => {
    try {
      const {
        tipo_venda,
        cliente_id,
        categoria_id,
        subcategoria_id,
        produtos_id,
        empresa_id,
        centro_custo_id,
        usuario_id,
        data_venda,
        situacao,
        valor_venda,
        desconto_venda,
        pagamento,
        conta_recebimento_api,
        parcelamento,
        vencimento,
        observacoes,
        natureza,
        observacoes_fiscais
      } = req.body;
  
      const [result] = await pool.query(
        `INSERT INTO vendas 
        (tipo_venda, cliente_id, categoria_id, subcategoria_id, produtos_id, empresa_id, centro_custo_id, usuario_id, data_venda, situacao, valor_venda, desconto_venda, pagamento, conta_recebimento_api, parcelamento, vencimento, observacoes, natureza, observacoes_fiscais)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          tipo_venda,
          cliente_id,
          categoria_id,
          subcategoria_id,
          produtos_id,
          empresa_id,
          centro_custo_id,
          usuario_id,
          data_venda,
          situacao,
          valor_venda,
          desconto_venda,
          pagamento,
          conta_recebimento_api,
          parcelamento,
          vencimento,
          observacoes,
          natureza,
          observacoes_fiscais
        ]
      );
  
      res.status(201).json({ message: "Venda criada com sucesso!", id: result.insertId });
    } catch (error) {
      console.error("❌ Erro ao criar venda:", error);
      res.status(500).json({ message: "Erro ao criar venda", error });
    }
  });  

// ✅ READ - Listar todas as vendas (com JOIN e filtros opcionais)
router.get("/", verifyToken, async (req, res) => {
  try {
    const { empresa_id, start_date, end_date, situacao } = req.query;

    let query = `
        SELECT 
          v.*,
          c.nome_fantasia AS cliente_nome,
          ps.nome AS produto_servico_nome,
          ct.nome AS categoria_nome,
          sc.nome AS sub_categoria_nome,
          co.nome AS empresa_nome,
          cc.nome AS centro_custo_nome,
          u.name AS vendedor_nome,
          cra.descricao_banco AS conta_recebimento_api_nome
        FROM vendas v
        LEFT JOIN clientes c ON v.cliente_id = c.id
        LEFT JOIN produtos ps ON v.produtos_id = ps.id
        LEFT JOIN straton_categorias ct ON v.categoria_id = ct.id
        LEFT JOIN straton_subcategorias sc ON v.subcategoria_id = sc.id
        LEFT JOIN empresas co ON v.empresa_id = co.id
        LEFT JOIN centro_custo cc ON v.centro_custo_id = cc.id
        LEFT JOIN usuarios u ON v.usuario_id = u.id
        LEFT JOIN contas cra ON v.conta_recebimento_api = cra.id
        WHERE 1=1
      `;

    let params = [];

    // Filtro por empresa
    if (empresa_id) {
      query += " AND v.empresa_id = ?";
      params.push(empresa_id);
    }

    // Filtro por período de data
    if (start_date && end_date) {
      query += " AND DATE(v.data_venda) BETWEEN ? AND ?";
      params.push(start_date, end_date);
    } else if (start_date) {
      query += " AND DATE(v.data_venda) >= ?";
      params.push(start_date);
    } else if (end_date) {
      query += " AND DATE(v.data_venda) <= ?";
      params.push(end_date);
    }

    // Filtro por situação
    if (situacao) {
      query += " AND v.situacao = ?";
      params.push(situacao);
    }

    query += " ORDER BY v.data_venda DESC";

    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (error) {
    console.error("❌ Erro ao listar vendas:", error);
    res.status(500).json({ message: "Erro ao listar vendas", error });
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
      const [empresas] = await pool.query("SELECT id, nome FROM empresas WHERE id = ?", [empresa_id]);
      const [centrosCusto] = await pool.query("SELECT id, nome FROM centro_de_custo WHERE empresa_id = ?", [empresa_id]);
      const [contas] = await pool.query("SELECT id, descricao_banco FROM contas WHERE empresa_id = ?", [empresa_id]);
  
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
  
      // usuários filtrados pela tabela pivô usuarios_empresas
      const [usuarios] = await pool.query(
        `SELECT u.id, u.nome 
         FROM usuarios u
         INNER JOIN usuarios_empresas uc ON uc.user_id = u.id
         WHERE uc.company_id = ?`,
        [empresa_id]
      );
  
      // retorna tudo pronto pro frontend
      res.json({
        clientes,
        produtosServicos,
        categorias,
        subCategorias,
        empresas,
        centrosCusto,
        usuarios,
        contas
      });
  
    } catch (error) {
      console.error("❌ Erro ao buscar dados para o form:", error);
      res.status(500).json({ message: "Erro ao buscar dados do formulário", error });
    }
  });  

// ✅ READ ONE - Buscar venda específica (com JOIN)
router.get("/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    const query = `
    SELECT 
        v.*,
        c.nome_fantasia AS cliente_nome,
        ps.nome AS produto_servico_nome,
        ct.nome AS categoria_nome,
        sc.nome AS sub_categoria_nome,
        co.nome AS empresa_nome,
        cc.nome AS centro_custo_nome,
        u.name AS vendedor_nome,
        cra.descricao_banco AS conta_recebimento_api_nome
    FROM vendas v
    LEFT JOIN clientes c ON v.cliente_id = c.id
    LEFT JOIN produtos ps ON v.produtos_id = ps.id
    LEFT JOIN straton_categorias ct ON v.categoria_id = ct.id
    LEFT JOIN straton_subcategorias sc ON v.subcategoria_id = sc.id
    LEFT JOIN empresas co ON v.empresa_id = co.id
    LEFT JOIN centro_de_custo cc ON v.centro_custo_id = cc.id
    LEFT JOIN usuarios u ON v.usuario_id = u.id
        LEFT JOIN contas cra ON v.conta_recebimento_api = cra.id
    WHERE v.id = ?
  `;  

    const [rows] = await pool.query(query, [id]);

    if (rows.length === 0) {
      return res.status(404).json({ message: "Venda não encontrada" });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error("❌ Erro ao buscar venda:", error);
    res.status(500).json({ message: "Erro ao buscar venda", error });
  }
});

// ✅ UPDATE - Atualizar venda (com suporte a atualizações parciais)
router.put("/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Construir a query dinamicamente baseada nos campos enviados
    const fields = [];
    const values = [];

    // Campos que podem ser atualizados
    const allowedFields = [
      'situacao',
      'categoria_id',
      'subcategoria_id', 
      'produtos_id',
      'centro_custo_id',
      'usuario_id',
      'valor_venda',
      'desconto_venda',
      'pagamento',
      'conta_recebimento_api',
      'parcelamento',
      'vencimento',
      'observacoes',
      'natureza',
      'observacoes_fiscais'
    ];

    // Adicionar apenas campos que foram enviados
    allowedFields.forEach(field => {
      if (updateData.hasOwnProperty(field)) {
        fields.push(`${field}=?`);
        values.push(updateData[field]);
      }
    });

    // Adicionar atualizado_em
    fields.push('atualizado_em=NOW()');

    if (fields.length === 0) {
      return res.status(400).json({ error: "Nenhum campo válido para atualização." });
    }

    // Adicionar o ID no final
    values.push(id);

    const query = `UPDATE vendas SET ${fields.join(', ')} WHERE id=?`;
    console.log('Query:', query);
    console.log('Values:', values);

    const [result] = await pool.query(query, values);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Venda não encontrada" });
    }

    res.json({ message: "Venda atualizada com sucesso!" });
  } catch (error) {
    console.error("❌ Erro ao atualizar venda:", error);
    res.status(500).json({ message: "Erro ao atualizar venda", error });
  }
});

// ✅ PATCH - Atualizar apenas a situação da venda
router.patch("/:id/situacao", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { situacao } = req.body;

    if (!situacao) {
      return res.status(400).json({ message: "O campo 'situacao' é obrigatório" });
    }

    const [result] = await pool.query(
      `UPDATE vendas SET situacao = ?, atualizado_em = NOW() WHERE id = ?`,
      [situacao, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Venda não encontrada" });
    }

    res.json({ message: "Situação da venda atualizada com sucesso!", situacao });
  } catch (error) {
    console.error("❌ Erro ao atualizar situação da venda:", error);
    res.status(500).json({ message: "Erro ao atualizar situação da venda", error });
  }
});

// ✅ DELETE - Remover venda
router.delete("/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const [result] = await pool.query("DELETE FROM vendas WHERE id = ?", [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Venda não encontrada" });
    }

    res.json({ message: "Venda deletada com sucesso!" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Erro ao deletar venda", error });
  }
});

// ✅ Gerar boleto manual para venda
router.post("/:id/gerar-boleto", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { data_vencimento, observacoes } = req.body;

    // Buscar dados da venda
    const [vendas] = await pool.query(`
      SELECT 
        v.*,
        c.nome_fantasia as cliente_nome,
        c.cnpj as cliente_cpf_cnpj,
        c.e_mail_principal as cliente_email,
        c.endereco as cliente_endereco,
        c.numero as cliente_numero,
        c.complemento as cliente_complemento,
        c.bairro as cliente_bairro,
        c.cidade as cliente_cidade,
        c.estado as cliente_estado,
        c.cep as cliente_cep,
        c.tipo_de_pessoa as cliente_tipo_pessoa,
        co.nome as empresa_nome
      FROM vendas v
      INNER JOIN clientes c ON v.cliente_id = c.id
      INNER JOIN empresas co ON v.empresa_id = co.id
      WHERE v.id = ?
    `, [id]);

    if (vendas.length === 0) {
      return res.status(404).json({ error: "Venda não encontrada." });
    }

    const venda = vendas[0];

    // Verificar se já existe boleto gerado manualmente para esta venda
    const [boletosExistentes] = await pool.query(
      "SELECT id FROM boletos WHERE venda_id = ? AND gerado_manualmente = 1",
      [id]
    );

    if (boletosExistentes.length > 0) {
      return res.status(400).json({ 
        error: "Já existe um boleto gerado manualmente para esta venda.",
        boleto_id: boletosExistentes[0].id
      });
    }

    // Usar data fornecida ou vencimento da venda
    let dataVencimento = data_vencimento || venda.vencimento;

    if (!dataVencimento) {
      return res.status(400).json({ error: "Data de vencimento é obrigatória." });
    }

    // Converter data para formato YYYY-MM-DD se necessário
    if (dataVencimento instanceof Date) {
      dataVencimento = dataVencimento.toISOString().split('T')[0];
    } else if (typeof dataVencimento === 'string' && dataVencimento.includes('T')) {
      dataVencimento = dataVencimento.split('T')[0];
    }

    // Preparar dados para gerar boleto via API Inter
    const boletoData = {
      seuNumero: `VENDA_${id}_${Date.now()}`.slice(0, 15),
      valorNominal: venda.valor_venda,
      dataVencimento: dataVencimento,
      numDiasAgenda: 60,
      pagador: {
        nome: venda.cliente_nome,
        cpfCnpj: venda.cliente_cpf_cnpj,
        email: venda.cliente_email || 'financeiro@contabhub.com.br',
        tipoPessoa: venda.cliente_tipo_pessoa === 'Jurídica' ? 'JURIDICA' : 'FISICA',
        endereco: venda.cliente_endereco || 'Endereço não informado',
        numero: venda.cliente_numero || 'S/N',
        complemento: venda.cliente_complemento || '',
        bairro: venda.cliente_bairro || 'Centro',
        cidade: venda.cliente_cidade || 'São Paulo',
        uf: venda.cliente_estado || 'SP',
        cep: venda.cliente_cep || '21070390'
      },
      formasRecebimento: ["BOLETO", "PIX"],
      mensagem: {
        linha1: `Venda ${id}`,
        linha2: observacoes || `Vencimento: ${dataVencimento}`
      },
      company_id: venda.empresa_id
    };

    // Fazer requisição para gerar boleto via API Inter
    const axios = require('axios');
    const response = await axios.post(
      `${req.protocol}://${req.get('host')}/inter-boletos/cobranca`,
      boletoData,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': req.headers.authorization
        }
      }
    );

    const boletoGerado = response.data;

    // Marcar boleto como gerado manualmente
    try {
      // Tentar atualizar com observações (se a coluna existir)
      await pool.query(
        `UPDATE boletos 
         SET gerado_manualmente = 1, 
             vencimento_original_venda = ?,
             observacoes = ?
         WHERE id = ?`,
        [venda.vencimento, observacoes || null, boletoGerado.insertId]
      );
    } catch (error) {
      // Se der erro por coluna não existir, atualizar sem observações
      if (error.code === 'ER_BAD_FIELD_ERROR' && error.message.includes('observacoes')) {
        await pool.query(
          `UPDATE boletos 
           SET gerado_manualmente = 1, 
               vencimento_original_venda = ?
           WHERE id = ?`,
          [venda.vencimento, boletoGerado.insertId]
        );
      } else {
        throw error;
      }
    }

    res.status(201).json({
      message: "Boleto gerado manualmente com sucesso!",
      boleto_id: boletoGerado.insertId,
      venda_id: id,
      data_vencimento: dataVencimento,
      link: boletoGerado.linkBoleto
    });

  } catch (error) {
    console.error("❌ Erro ao gerar boleto manual:", error);
    res.status(500).json({ error: "Erro ao gerar boleto manual." });
  }
});

module.exports = router;