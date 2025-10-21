const express = require("express");
const router = express.Router();
const multer = require("multer");
const XLSX = require("xlsx");
const pool = require("../../config/database");
const verifyToken = require("../../middlewares/auth");

// 📥 Upload em memória
const upload = multer({ storage: multer.memoryStorage() });

// 🔁 Utilitários
const parseDate = (str) => {
    if (!str) return null;
  
    // Se já for Date (Excel pode mandar isso!), retorna direto
    if (Object.prototype.toString.call(str) === "[object Date]") return str;
  
    // Se vier como número (número serial Excel), converte corretamente
    if (typeof str === "number") {
      const excelBaseDate = new Date(1899, 11, 30);
      return new Date(excelBaseDate.getTime() + str * 24 * 60 * 60 * 1000);
    }
  
    // Normaliza se for string "dd/mm/yyyy"
    if (typeof str === "string") {
      const [dia, mes, ano] = str.split("/");
      if (!dia || !mes || !ano) return null;
      return new Date(`${ano}-${mes}-${dia}`);
    }
  
    return null; // fallback
  };

const parseValor = (str) => {
  if (!str) return 0;
  return Number(
    str.replace("R$", "").replace(/\./g, "").replace(",", ".").trim()
  );
};

// 🔹 POST /api/import/contas-a-pagar/:empresaId
router.post(
  "/contas-a-pagar/:empresaId",
  verifyToken,
  upload.single("arquivo"),
  async (req, res) => {
    const { empresaId } = req.params;
    const { save } = req.body;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ erro: "Nenhum arquivo enviado." });
    }

    try {
      const workbook = XLSX.read(file.buffer, { type: "buffer" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet);

      if (!save) {
        return res.status(200).json({
          mensagem: "Planilha lida com sucesso.",
          preview: rows.slice(0, 5),
          total: rows.length,
        });
      }

      // 🔁 LOOP para inserção
      for (const row of rows) {
        // 🔸 Categorias e subcategorias agora são globais (sem empresa_id)
        const [categoria] = await pool.query(
          "SELECT id FROM straton_categorias WHERE nome = ?",
          [row["Categoria"]]
        );

        const [subcategoria] = await pool.query(
          "SELECT id FROM straton_subcategorias WHERE nome = ?",
          [row["Subcategoria"]]
        );

        const [cliente] = await pool.query(
          "SELECT id FROM clientes WHERE nome_fantasia = ? AND empresa_id = ?",
          [row["Cliente/Fornecedor"], empresaId]
        );
        const [conta] = await pool.query(
          "SELECT id FROM contas WHERE banco = ? AND empresa_id = ?",
          [row["Conta"], empresaId]
        );
        const [centro] = await pool.query(
          "SELECT id FROM centro_de_custo WHERE nome = ? AND empresa_id = ?",
          [row["Centro de Custo"], empresaId]
        );

        await pool.query(
          `INSERT INTO transacoes (
            data_vencimento, data_transacao, valor,
            categoria_id, subcategoria_id, descricao,
            cliente_id, conta_id, centro_custo_id,
            observacao, origem, situacao, tipo, empresa_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            parseDate(row["Vencimento"]),
            parseDate(row["Pagamento"]),
            parseValor(row["Valor"]),
            categoria[0]?.id || null,
            subcategoria[0]?.id || null,
            row["Descrição"] || "",
            cliente[0]?.id || null,
            conta[0]?.id || null,
            centro[0]?.id || null,
            row["Observações"] || "",
            row["Origem"] || "",
            row["Situação"] || "",
            "saida",
            empresaId,
          ]
        );
      }

      return res.status(200).json({
        mensagem: `Importação concluída com sucesso. ${rows.length} registros salvos.`,
      });
    } catch (error) {
      console.error("Erro ao importar e salvar planilha:", error);
      return res
        .status(500)
        .json({ erro: "Erro ao processar ou salvar os dados." });
    }
  }
);

// 🔹 POST /api/import/contas-a-receber/:empresaId
router.post(
  "/contas-a-receber/:empresaId",
  verifyToken,
  upload.single("arquivo"),
  async (req, res) => {
    const { empresaId } = req.params;
    const { save } = req.body;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ erro: "Nenhum arquivo enviado." });
    }

    try {
      const workbook = XLSX.read(file.buffer, { type: "buffer" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet);

      if (!save) {
        return res.status(200).json({
          mensagem: "Planilha lida com sucesso.",
          preview: rows.slice(0, 5),
          total: rows.length,
        });
      }

      for (const row of rows) {
        const [categoria] = await pool.query(
          "SELECT id FROM straton_categorias WHERE nome = ?",
          [row["Categoria"]]
        );

        const [subcategoria] = await pool.query(
          "SELECT id FROM straton_subcategorias WHERE nome = ?",
          [row["Subcategoria"]]
        );

        const [cliente] = await pool.query(
          "SELECT id FROM clientes WHERE nome_fantasia = ? AND empresa_id = ?",
          [row["Cliente/Fornecedor"], empresaId]
        );

        const [conta] = await pool.query(
          "SELECT id FROM contas WHERE banco = ? AND empresa_id = ?",
          [row["Conta"], empresaId]
        );

        const [centro] = await pool.query(
          "SELECT id FROM centro_de_custo WHERE nome = ? AND empresa_id = ?",
          [row["Centro de Custo"], empresaId]
        );

        await pool.query(
          `INSERT INTO transacoes (
              data_vencimento, data_transacao, valor,
              categoria_id, subcategoria_id, descricao,
              cliente_id, conta_id, centro_custo_id,
              observacao, origem, situacao, tipo, empresa_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            parseDate(row["Vencimento"]),
            parseDate(row["Pagamento"]),
            parseValor(row["Valor"]),
            categoria[0]?.id || null,
            subcategoria[0]?.id || null,
            row["Descrição"] || "",
            cliente[0]?.id || null,
            conta[0]?.id || null,
            centro[0]?.id || null,
            row["Observações"] || "",
            row["Origem"] || "",
            row["Situação"] || "",
            "entrada", // 👈 ALTERADO AQUI!
            empresaId,
          ]
        );
      }

      return res.status(200).json({
        mensagem: `Importação de contas a receber concluída. ${rows.length} registros salvos.`,
      });
    } catch (error) {
      console.error("Erro ao importar contas a receber:", error);
      return res
        .status(500)
        .json({ erro: "Erro ao processar ou salvar os dados." });
    }
  }
);

router.post(
  "/movimentacoes/:empresaId",
  verifyToken,
  upload.single("arquivo"),
  async (req, res) => {
    const { empresaId } = req.params;
    const { save } = req.body;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ erro: "Nenhum arquivo enviado." });
    }

    try {
      const workbook = XLSX.read(file.buffer, { type: "buffer" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet);

      if (!save) {
        return res.status(200).json({
          mensagem: "Planilha lida com sucesso.",
          preview: rows.slice(0, 5),
          total: rows.length,
        });
      }

      for (const row of rows) {
        const tipoRaw = (row["Tipo"] || "")
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "");
        const tipo = tipoRaw === "entrada" ? "entrada" : "saida"; // Garantir consistência

        const [categoria] = await pool.query(
          "SELECT id FROM straton_categorias WHERE nome = ?",
          [row["Categoria"]]
        );

        const [subcategoria] = await pool.query(
          "SELECT id FROM straton_subcategorias WHERE nome = ?",
          [row["Subcategoria"]]
        );

        const [cliente] = await pool.query(
          "SELECT id FROM clientes WHERE nome_fantasia = ? AND empresa_id = ?",
          [row["Cliente/Fornecedor"], empresaId]
        );

        const [conta] = await pool.query(
          "SELECT id FROM contas WHERE banco = ? AND empresa_id = ?",
          [row["Conta"], empresaId]
        );

        const [centro] = await pool.query(
          "SELECT id FROM centro_de_custo WHERE nome = ? AND empresa_id = ?",
          [row["Centro de Custo"], empresaId]
        );

        await pool.query(
          `INSERT INTO transacoes (
              data_vencimento, data_transacao, valor,
              categoria_id, subcategoria_id, descricao,
              cliente_id, conta_id, centro_custo_id,
              observacao, origem, situacao, tipo, empresa_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            parseDate(row["Vencimento"]),
            parseDate(row["Pagamento"]),
            parseValor(row["Valor"]),
            categoria[0]?.id || null,
            subcategoria[0]?.id || null,
            row["Descrição"] || "",
            cliente[0]?.id || null,
            conta[0]?.id || null,
            centro[0]?.id || null,
            row["Observações"] || "",
            row["Origem"] || "",
            row["Situação"] || "",
            tipo,
            empresaId,
          ]
        );
      }

      return res.status(200).json({
        mensagem: `Importação de movimentações concluída com sucesso. ${rows.length} registros inseridos.`,
      });
    } catch (error) {
      console.error("Erro ao importar movimentações:", error);
      return res
        .status(500)
        .json({ erro: "Erro ao processar ou salvar os dados." });
    }
  }
);

module.exports = router;
