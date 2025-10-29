const express = require("express");
const { obterXMLAssinado, enviarXMLParaSerpro } = require("../../services/gestao/authprocuradorService");
const SitFisModel = require("../../models/SitFisModel");
const { gerarSituacaoFiscal } = require("../../services/gestao/consultarService");

const router = express.Router();

/**
 * 📌 Rota que obtém o XML assinado e envia para a API da Serpro com autenticação
 */
router.post("/enviar-xml", async (req, res) => {
    try {
        const { arquivoCertificado, senhaCertificado, autorPedido, contribuinte } = req.body;

        if (!arquivoCertificado || !senhaCertificado || !autorPedido || !contribuinte) {
            return res.status(400).json({ error: "Todos os campos são obrigatórios." });
        }

        // 🔹 Passo 1: Obtém o XML assinado da API intermediária
        const xmlBase64 = await obterXMLAssinado(arquivoCertificado, senhaCertificado, autorPedido);

        // 🔹 Passo 2: Envia o XML assinado para a API da Serpro com autenticação
        const response = await enviarXMLParaSerpro(autorPedido, contribuinte, xmlBase64);

        res.json({ message: "XML enviado para Serpro com sucesso!", response });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Rota para obter e armazenar a situação fiscal
router.post("/situacao-fiscal/:clienteId/:empresaId", async (req, res) => {
    try {
      const { clienteId, empresaId } = req.params;
      const binaryFile = await gerarSituacaoFiscal(clienteId);
  
      if (!binaryFile) {
        return res.status(400).json({ error: "Erro ao gerar situação fiscal" });
      }
  
      // Simulando a análise do status fiscal (pode ser feita por um parser depois)
      const status = Math.random() > 0.5 ? "Regular" : "Irregular"; // Exemplo
  
      await SitFisModel.salvarRelatorio(clienteId, empresaId, binaryFile, status);
  
      res.json({ message: "Situação Fiscal salva com sucesso!" });
    } catch (error) {
      console.error("Erro ao salvar Situação Fiscal:", error);
      res.status(500).json({ error: "Erro interno do servidor" });
    }
  });

  router.get("/:empresaId", async (req, res) => {
    try {
        const { empresaId } = req.params;

        const [sitFisData] = await db.execute(
            `SELECT status, COUNT(*) as total FROM sitfis 
             WHERE empresa_id = ? GROUP BY status`,
            [empresaId]
        );

        res.json(sitFisData);
    } catch (error) {
        console.error("❌ Erro ao buscar Situação Fiscal:", error);
        res.status(500).json({ error: "Erro ao buscar Situação Fiscal" });
    }
});

module.exports = router;