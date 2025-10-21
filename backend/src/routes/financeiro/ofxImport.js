const express = require("express");
const router = express.Router();
const pool = require("../../config/database");
const verifyToken = require("../../middlewares/auth");
const ofx = require("node-ofx-parser");

// Rota para receber OFX em Base64
router.post("/", verifyToken, async (req, res) => {
  try {
    const { arquivoBase64, conta_id, empresa_id } = req.body;

    if (!arquivoBase64) {
      return res.status(400).json({ error: "Arquivo OFX não enviado." });
    }

    // Converte Base64 -> string OFX
    const rawOFX = Buffer.from(arquivoBase64, "base64").toString("utf8");

    // Faz o parse
    const parsed = ofx.parse(rawOFX);
    const transacoes = parsed?.OFX?.BANKMSGSRSV1?.STMTTRNRS?.STMTRS?.BANKTRANLIST?.STMTTRN;

    if (!Array.isArray(transacoes)) {
      return res.status(400).json({ error: "Nenhuma transação encontrada." });
    }

    for (const t of transacoes) {
      const tipo = t.TRNAMT.includes("-") ? "saida" : "entrada";
      const valor = parseFloat(t.TRNAMT.replace(",", "."));
      const descricao = t.MEMO || "Sem descrição";

      const rawDate = t.DTPOSTED.substring(0, 8);
      const data_transacao = `${rawDate.substring(0, 4)}-${rawDate.substring(4, 6)}-${rawDate.substring(6, 8)}`;
      const origem = "Importação OFX";
      const situacao = "recebido"; // Status fixo para transações importadas

      await pool.query(`
        INSERT INTO transacoes 
        (conta_id, empresa_id, tipo, valor, descricao, data_transacao, origem, situacao, criado_em)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
      `, [
        conta_id,
        empresa_id,
        tipo,
        valor,
        descricao,
        data_transacao,
        origem,
        situacao,
      ]);
    }

    res.json({ message: "Transações importadas com sucesso." });
  } catch (error) {
    console.error("Erro ao importar OFX:", error);
    res.status(500).json({ error: "Erro ao importar OFX." });
  }
});

module.exports = router;