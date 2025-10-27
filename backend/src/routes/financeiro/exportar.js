const express = require("express");
const router = express.Router();
const XLSX = require("xlsx");
const pool = require("../../config/database");
const verifyToken = require("../../middlewares/auth");
const { format } = require("date-fns");
const { ptBR } = require("date-fns/locale");

// 🔹 GET /api/export/saidas/:empresaId?mes=06&ano=2025
router.get("/saidas/:empresaId", verifyToken, async (req, res) => {
  const { empresaId } = req.params;
  const { mes, ano } = req.query;

  try {
    // 1. Query para buscar transações de saída com JOINs
    let query = `
      SELECT 
        t.data_vencimento,
        t.data_transacao,
        t.valor,
        c.nome AS categoria,
        sc.nome AS subcategoria,
        t.descricao,
        cl.nome_fantasia AS cliente_fornecedor,
        co.banco AS conta_nome,
        cc.nome AS centro_custo,
        t.observacao,
        t.origem,
        t.situacao
      FROM transacoes t
      LEFT JOIN straton_categorias c ON c.id = t.categoria_id
      LEFT JOIN straton_subcategorias sc ON sc.id = t.subcategoria_id
      LEFT JOIN clientes cl ON cl.id = t.cliente_id
      LEFT JOIN caixinha co ON co.id = t.conta_id
      LEFT JOIN centro_custo cc ON cc.id = t.centro_custo_id
      WHERE t.empresa_id = ? AND t.tipo = 'saida'
    `;

    const params = [empresaId];

    // Filtro por mês e ano, se fornecido
    if (mes && ano) {
      query += ` AND MONTH(t.data_vencimento) = ? AND YEAR(t.data_vencimento) = ?`;
      params.push(mes, ano);
    }

    const [rows] = await pool.query(query, params);
    console.log("🔎 Resultado bruto da query:", rows);

    // 2. Mapeia os dados para a planilha
    const dadosPlanilha = rows.map((item) => ({
      Vencimento: item.data_vencimento
        ? format(new Date(item.data_vencimento), "dd/MM/yyyy")
        : "",
      Pagamento: item.data_transacao
        ? format(new Date(item.data_transacao), "dd/MM/yyyy")
        : "",
      Valor: Number(item.valor).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
      }),
      Categoria: item.categoria || "",
      Subcategoria: item.subcategoria || "",
      Descrição: item.descricao || "",
      "Cliente/Fornecedor": item.cliente_fornecedor || "",
      Conta: item.conta_nome || "",
      "Centro de Custo": item.centro_custo || "",
      Observações: item.observacao || "",
      Origem: item.origem || "",
      Situação: item.situacao || "",
    }));

    console.log("📄 Dados formatados para planilha:", dadosPlanilha);

    // 3. Cria a planilha
    const ws = XLSX.utils.json_to_sheet(dadosPlanilha);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Contas a Pagar");

    // 4. Formatação básica (largura das colunas)
    ws["!cols"] = [
      { wch: 15 }, // Vencimento
      { wch: 15 }, // Pagamento
      { wch: 12 }, // Valor
      { wch: 30 }, // Categoria
      { wch: 30 }, // Subcategoria
      { wch: 40 }, // Descrição
      { wch: 30 }, // Cliente/Fornecedor
      { wch: 25 }, // Conta
      { wch: 25 }, // Centro de Custo
      { wch: 40 }, // Observações
      { wch: 20 }, // Origem
      { wch: 20 }, // Situação
    ];

    // 5. Retorna para download
    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    const mesStr = mes || "todos";
    const anoStr = ano || "todos";
    const nomeArquivo = `contas-a-pagar-${mesStr}-${anoStr}.xlsx`.replace(
      /[^\w.-]/g,
      "_"
    );

    res.setHeader("Content-Disposition", `attachment; filename=${nomeArquivo}`);
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.send(buffer);
  } catch (error) {
    console.error("Erro ao exportar planilha:", error);
    res.status(500).json({ erro: "Erro ao gerar planilha." });
  }
});

router.get("/saidas-simples/:empresaId", verifyToken, async (req, res) => {
  const { empresaId } = req.params;

  try {
    const [rows] = await pool.query(
      `
        SELECT 
          t.data_vencimento,
          t.data_transacao,
          t.valor,
          c.nome AS categoria,
          sc.nome AS subcategoria,
          t.descricao,
          cl.nome_fantasia AS cliente_fornecedor,
          co.banco AS conta_nome,
          cc.nome AS centro_custo,
          t.observacao,
          t.origem,
          t.situacao
        FROM transacoes t
        LEFT JOIN straton_categorias c ON c.id = t.categoria_id
        LEFT JOIN straton_subcategorias sc ON sc.id = t.subcategoria_id
        LEFT JOIN clientes cl ON cl.id = t.cliente_id
        LEFT JOIN caixinha co ON co.id = t.conta_id
        LEFT JOIN centro_custo cc ON cc.id = t.centro_custo_id
        WHERE t.empresa_id = ? AND t.tipo = 'saida'
        `,
      [empresaId]
    );

    console.log("🔎 Resultado bruto da query:", rows);

    const dadosPlanilha = rows.map((item) => ({
      Vencimento: item.data_vencimento
        ? format(new Date(item.data_vencimento), "dd/MM/yyyy")
        : "",
      Pagamento: item.data_transacao
        ? format(new Date(item.data_transacao), "dd/MM/yyyy")
        : "",
      Valor: Number(item.valor).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
      }),
      Categoria: item.categoria || "",
      Subcategoria: item.subcategoria || "",
      Descrição: item.descricao || "",
      "Cliente/Fornecedor": item.cliente_fornecedor || "",
      Conta: item.conta_nome || "",
      "Centro de Custo": item.centro_custo || "",
      Observações: item.observacao || "",
      Origem: item.origem || "",
      Situação: item.situacao || "",
    }));

    console.log("📄 Dados formatados para planilha:", dadosPlanilha);

    const ws = XLSX.utils.json_to_sheet(dadosPlanilha);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Contas a Pagar");

    ws["!cols"] = [
      { wch: 15 }, // Vencimento
      { wch: 15 }, // Pagamento
      { wch: 12 }, // Valor
      { wch: 30 }, // Categoria
      { wch: 30 }, // Subcategoria
      { wch: 40 }, // Descrição
      { wch: 30 }, // Cliente/Fornecedor
      { wch: 25 }, // Conta
      { wch: 25 }, // Centro de Custo
      { wch: 40 }, // Observações
      { wch: 20 }, // Origem
      { wch: 20 }, // Situação
    ];

    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    const nomeArquivo = `contas-a-pagar-completo-${empresaId}.xlsx`;

    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${nomeArquivo}"`
    );
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.send(buffer);
  } catch (error) {
    console.error("Erro ao exportar planilha simples:", error);
    res.status(500).json({ erro: "Erro ao gerar planilha simples." });
  }
});

// 🔹 GET /export/entradas/:empresaId?mes=06&ano=2025
router.get("/entradas/:empresaId", verifyToken, async (req, res) => {
  const { empresaId } = req.params;
  const { mes, ano } = req.query;

  try {
    let query = `
        SELECT 
          t.data_vencimento,
          t.data_transacao,
          t.valor,
          c.nome AS categoria,
          sc.nome AS subcategoria,
          t.descricao,
          cl.nome_fantasia AS cliente_fornecedor,
          co.banco AS conta_nome,
          cc.nome AS centro_custo,
          t.observacao,
          t.origem,
          t.situacao
        FROM transacoes t
        LEFT JOIN straton_categorias c ON c.id = t.categoria_id
        LEFT JOIN straton_subcategorias sc ON sc.id = t.subcategoria_id
        LEFT JOIN clientes cl ON cl.id = t.cliente_id
        LEFT JOIN caixinha co ON co.id = t.conta_id
        LEFT JOIN centro_custo cc ON cc.id = t.centro_custo_id
        WHERE t.empresa_id = ? AND t.tipo = 'entrada'
      `;

    const params = [empresaId];

    if (mes && ano) {
      query += ` AND MONTH(t.data_vencimento) = ? AND YEAR(t.data_vencimento) = ?`;
      params.push(mes, ano);
    }

    const [rows] = await pool.query(query, params);
    console.log("🔎 Entradas encontradas:", rows);

    const dadosPlanilha = rows.map((item) => ({
      Vencimento: item.data_vencimento
        ? format(new Date(item.data_vencimento), "dd/MM/yyyy")
        : "",
      Pagamento: item.data_transacao
        ? format(new Date(item.data_transacao), "dd/MM/yyyy")
        : "",
      Valor: Number(item.valor).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
      }),
      Categoria: item.categoria || "",
      Subcategoria: item.subcategoria || "",
      Descrição: item.descricao || "",
      "Cliente/Fornecedor": item.cliente_fornecedor || "",
      Conta: item.conta_nome || "",
      "Centro de Custo": item.centro_custo || "",
      Observações: item.observacao || "",
      Origem: item.origem || "",
      Situação: item.situacao || "",
    }));

    const ws = XLSX.utils.json_to_sheet(dadosPlanilha);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Contas a Receber");

    ws["!cols"] = [
      { wch: 15 }, // Vencimento
      { wch: 15 }, // Pagamento
      { wch: 12 }, // Valor
      { wch: 30 }, // Categoria
      { wch: 30 }, // Subcategoria
      { wch: 40 }, // Descrição
      { wch: 30 }, // Cliente/Fornecedor
      { wch: 25 }, // Conta
      { wch: 25 }, // Centro de Custo
      { wch: 40 }, // Observações
      { wch: 20 }, // Origem
      { wch: 20 }, // Situação
    ];

    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    const mesStr = mes || "todos";
    const anoStr = ano || "todos";
    const nomeArquivo = `contas-a-receber-${mesStr}-${anoStr}.xlsx`.replace(
      /[^\w.-]/g,
      "_"
    );

    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${nomeArquivo}"`
    );
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.send(buffer);
  } catch (error) {
    console.error("Erro ao exportar planilha de entradas:", error);
    res.status(500).json({ erro: "Erro ao gerar planilha de entradas." });
  }
});

router.get("/movimentacoes/:empresaId", verifyToken, async (req, res) => {
  const { empresaId } = req.params;
  const { mes, ano } = req.query;

  try {
    let query = `
        SELECT 
          t.tipo,
          t.data_vencimento,
          t.data_transacao,
          t.valor,
          c.nome AS categoria,
          sc.nome AS subcategoria,
          t.descricao,
          cl.nome_fantasia AS cliente_fornecedor,
          co.banco AS conta_nome,
          cc.nome AS centro_custo,
          t.observacao,
          t.origem,
          t.situacao
        FROM transacoes t
        LEFT JOIN straton_categorias c ON c.id = t.categoria_id
        LEFT JOIN straton_subcategorias sc ON sc.id = t.subcategoria_id
        LEFT JOIN clientes cl ON cl.id = t.cliente_id
        LEFT JOIN caixinha co ON co.id = t.conta_id
        LEFT JOIN centro_custo cc ON cc.id = t.centro_custo_id
        WHERE t.empresa_id = ?
      `;

    const params = [empresaId];

    if (mes && ano) {
      query += ` AND MONTH(t.data_vencimento) = ? AND YEAR(t.data_vencimento) = ?`;
      params.push(mes, ano);
    }

    // Ordenar por tipo primeiro (entrada antes de saída), depois por data
    query += ` ORDER BY t.tipo ASC, t.data_vencimento ASC`;

    const [rows] = await pool.query(query, params);
    console.log("🔎 Movimentações encontradas:", rows);

    const dadosPlanilha = rows.map((item) => ({
      Tipo: item.tipo === "entrada" ? "Entrada" : "Saída",
      Vencimento: item.data_vencimento
        ? format(new Date(item.data_vencimento), "dd/MM/yyyy")
        : "",
      Pagamento: item.data_transacao
        ? format(new Date(item.data_transacao), "dd/MM/yyyy")
        : "",
      Valor: Number(item.valor).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
      }),
      Categoria: item.categoria || "",
      Subcategoria: item.subcategoria || "",
      Descrição: item.descricao || "",
      "Cliente/Fornecedor": item.cliente_fornecedor || "",
      Conta: item.conta_nome || "",
      "Centro de Custo": item.centro_custo || "",
      Observações: item.observacao || "",
      Origem: item.origem || "",
      Situação: item.situacao || "",
    }));

    const ws = XLSX.utils.json_to_sheet(dadosPlanilha);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Movimentações");

    ws["!cols"] = [
      { wch: 10 }, // Tipo
      { wch: 15 }, // Vencimento
      { wch: 15 }, // Pagamento
      { wch: 12 }, // Valor
      { wch: 30 }, // Categoria
      { wch: 30 }, // Subcategoria
      { wch: 40 }, // Descrição
      { wch: 30 }, // Cliente/Fornecedor
      { wch: 25 }, // Conta
      { wch: 25 }, // Centro de Custo
      { wch: 40 }, // Observações
      { wch: 20 }, // Origem
      { wch: 20 }, // Situação
    ];

    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    const mesStr = mes || "todos";
    const anoStr = ano || "todos";
    const nomeArquivo = `movimentacoes-${mesStr}-${anoStr}.xlsx`.replace(
      /[^\w.-]/g,
      "_"
    );

    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${nomeArquivo}"`
    );
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.send(buffer);
  } catch (error) {
    console.error("Erro ao exportar movimentações:", error);
    res.status(500).json({ erro: "Erro ao gerar planilha de movimentações." });
  }
});

module.exports = router;
