const express = require("express");
const router = express.Router();
const db = require("../../config/database");
const { consultarDCTFWeb } = require("../../services/gestao/dctfwebService");
const { autenticarToken } = require("../../middlewares/auth");

// 🔹 GET: listar todas DCTFWeb de uma empresa
router.get("/:empresaId", autenticarToken, async (req, res) => {
  const { empresaId } = req.params;
  const [rows] = await db.query(
    `SELECT d.*, c.nome AS clienteNome, c.cnpjCpf
     FROM dctfweb d
     JOIN clientes c ON d.cliente_id = c.id
     WHERE d.empresa_id = ?`,
    [empresaId]
  );
  res.json(rows);
});

// 🔹 GET: listar DCTFWeb de um cliente específico
router.get("/cliente/:clienteId", autenticarToken, async (req, res) => {
  const { clienteId } = req.params;
  const [rows] = await db.query(
    `SELECT * FROM dctfweb WHERE cliente_id = ? ORDER BY data_criacao DESC`,
    [clienteId]
  );
  res.json(rows);
});

// 🔹 POST: consultar nova DCTFWeb e salvar no banco
router.post("/", autenticarToken, async (req, res) => {
  try {
    const { empresaId, clienteId, categoria, anoPA, mesPA } = req.body;

    if (!empresaId || !clienteId || !categoria || !anoPA || !mesPA) {
      return res.status(400).json({ erro: "Dados obrigatórios ausentes." });
    }

    const xml = await consultarDCTFWeb(empresaId, clienteId, categoria, anoPA, mesPA);
    res.status(200).json({ mensagem: "✅ Consulta realizada com sucesso!", xml });
  } catch (error) {
    console.error("❌ Erro na consulta da DCTFWeb:", error);
    res.status(500).json({ erro: error.message });
  }
});

// 🔹 POST: consultar todos os clientes da empresa
router.post("/empresa/:empresaId", autenticarToken, async (req, res) => {
  const { empresaId } = req.params;
  const categoria = "40"; // fixa para testes
  const hoje = new Date();
  const anoPA = hoje.getFullYear().toString();
  const mesPA = (hoje.getMonth() + 1).toString().padStart(2, "0");

  try {
    const [clientes] = await db.execute(
      `SELECT id FROM clientes WHERE empresaId = ?`,
      [empresaId]
    );

    let resultados = [];

    for (const cliente of clientes) {
      const clienteId = cliente.id;

      const [existe] = await db.execute(
        `SELECT id FROM dctfweb 
         WHERE empresa_id = ? AND cliente_id = ?
         AND competencia = ?`,
        [empresaId, clienteId, `${mesPA}/${anoPA}`]
      );

      if (existe.length > 0) {
        resultados.push({ clienteId, status: "já consultado" });
        continue;
      }

      try {
        await consultarDCTFWeb(empresaId, clienteId, categoria, anoPA, mesPA);
        resultados.push({ clienteId, status: "consultado" });
      } catch (erroCliente) {
        resultados.push({ clienteId, status: "erro", erro: erroCliente.message });
      }
    }

    res.json({ empresaId, total: resultados.length, resultados });

  } catch (err) {
    console.error("❌ Erro geral:", err);
    res.status(500).json({ erro: "Erro geral ao consultar DCTFWeb" });
  }
});

// 🔹 POST: consultar e salvar DCTFWeb para um único cliente
router.post("/consultar-individual/:empresaId/:clienteId", autenticarToken, async (req, res) => {
  try {
    const { empresaId, clienteId } = req.params;
    const { categoria, anoPA, mesPA } = req.body;

    if (!empresaId || !clienteId || !categoria || !anoPA || !mesPA) {
      return res.status(400).json({ erro: "Dados obrigatórios ausentes." });
    }

    // Consultar a DCTFWeb para o cliente
    const resultado = await consultarDCTFWeb(empresaId, clienteId, categoria, anoPA, mesPA);

    if (resultado) {
      res.status(200).json({
        mensagem: "✅ DCTFWeb processada e registrada com sucesso!"
      });
    } else {
      res.status(400).json({
        mensagem: "⚠️ Já foi processada ou não houve dados para salvar."
      });
    }

  } catch (error) {
    console.error("❌ Erro na consulta da DCTFWeb:", error);
    res.status(500).json({ erro: error.message });
  }
}); // 👈 ESSA CHAVE estava faltando!

module.exports = router;