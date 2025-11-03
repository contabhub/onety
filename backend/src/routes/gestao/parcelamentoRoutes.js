const express = require("express");
const router = express.Router();
const {
  processarParcelamentosPorEmpresaId,
  consultarParcelamentosPorEmpresaId,
  salvarParcelamentos,
} = require("../../services/gestao/parcelamentosService");
const db = require("../../config/database");

/**
 * 🔹 Rota para processar e salvar parcelamentos do Simples Nacional
 */
router.post("/api/parcelamentos/:empresaId", async (req, res) => {
  const empresaId = req.params.empresaId;

  try {
    await processarParcelamentosPorEmpresaId(empresaId);
    res.json({
      sucesso: true,
      mensagem: "Parcelamentos processados e salvos com sucesso!",
    });
  } catch (error) {
    console.error("❌ Erro ao processar parcelamentos:", error.message);
    res.status(500).json({ erro: error.message });
  }
});

// 👇 ROTA PARA TESTAR SOMENTE UM CLIENTE COM EMISSÃO DA GUIA
router.get(
  "/api/parcelamentos/testar/:empresaId/:clienteId",
  async (req, res) => {
    const empresaId = parseInt(req.params.empresaId);
    const clienteId = parseInt(req.params.clienteId);

    try {
      const [empresaRows] = await db.execute(
        "SELECT cnpj FROM empresas WHERE id = ?",
        [empresaId]
      );
      const empresa = empresaRows[0];

      if (!empresa)
        return res.status(404).json({ error: "Empresa não encontrada." });

      const [clienteRows] = await db.execute(
        "SELECT id, razao_social as nome, cpf_cnpj as cnpjCpf FROM clientes WHERE id = ? AND empresa_id = ?",
        [clienteId, empresaId]
      );
      const cliente = clienteRows[0];

      if (!cliente)
        return res.status(404).json({ error: "Cliente não encontrado." });

      const { consultarServico } = require("../../services/gestao/consultarService");

      const resultado = await consultarServico(
        "17422651000172",
        empresa.cnpj.replace(/[^\d]/g, ""), // ✅ CNPJ real da empresa
        cliente.cnpjCpf.replace(/[^\d]/g, ""),
        "PARCSN",
        "PEDIDOSPARC163"
      );

      let dadosParcelamento = resultado?.dados;
      if (typeof dadosParcelamento === "string" && dadosParcelamento.trim()) {
        try {
          dadosParcelamento = JSON.parse(dadosParcelamento);
        } catch (e) {
          return res
            .status(500)
            .json({ error: "Erro ao parsear retorno da API." });
        }
      }

      const parcelamentos = dadosParcelamento?.parcelamentos || [];

      if (!parcelamentos.length) {
        return res.status(204).json({ message: "Cliente sem parcelamentos." });
      }

      // ✅ Salva e emite o DAS automaticamente
      await salvarParcelamentos(
        [
          {
            clienteId: cliente.id,
            nome: cliente.nome,
            cnpj: cliente.cnpjCpf.replace(/[^\d]/g, ""),
            parcelamentos,
          },
        ],
        empresaId
      );

      res.json({
        message: `Parcelamento e DAS emitidos para cliente ${cliente.nome}`,
      });
    } catch (err) {
      console.error("❌ Erro na rota de teste individual:", err.message);
      res.status(500).json({ error: "Erro ao processar o cliente." });
    }
  }
);

// 🔹 Rota para consultar parcelamentos de clientes selecionados
router.post(
  "/api/parcelamentos/:empresaId/clientes-selecionados",
  async (req, res) => {
    const empresaId = parseInt(req.params.empresaId);
    const { clientesSelecionados } = req.body;

    if (
      !Array.isArray(clientesSelecionados) ||
      clientesSelecionados.length === 0
    ) {
      return res.status(400).json({ error: "Nenhum cliente selecionado." });
    }

    try {
      const [empresaRows] = await db.execute(
        "SELECT cnpj FROM empresas WHERE id = ?",
        [empresaId]
      );
      const empresa = empresaRows[0];
      if (!empresa)
        return res.status(404).json({ error: "Empresa não encontrada." });

      const clientesData = await db.query(
        `SELECT id, razao_social as nome, cpf_cnpj as cnpjCpf FROM clientes WHERE id IN (?) AND empresa_id = ?`,
        [clientesSelecionados, empresaId]
      );

      const { consultarServico } = require("../../services/gestao/consultarService");

      const resultados = [];

      for (const cliente of clientesData[0]) {
        try {
          const resultado = await consultarServico(
            "17422651000172",
            empresa.cnpj.replace(/[^\d]/g, ""), // <-- CNPJ real da empresa
            cliente.cnpjCpf.replace(/[^\d]/g, ""),
            "PARCSN",
            "PEDIDOSPARC163"
          );

          let dadosParcelamento = resultado?.dados;
          if (
            typeof dadosParcelamento === "string" &&
            dadosParcelamento.trim()
          ) {
            try {
              dadosParcelamento = JSON.parse(dadosParcelamento);
            } catch (e) {
              console.warn(
                `⚠️ Erro ao parsear retorno da API para cliente ${cliente.nome}`
              );
              continue;
            }
          }

          const parcelamentos = dadosParcelamento?.parcelamentos || [];
          if (!parcelamentos.length) {
            console.log(`ℹ️ Cliente ${cliente.nome} sem parcelamentos.`);
            continue;
          }

          resultados.push({
            clienteId: cliente.id,
            nome: cliente.nome,
            cnpj: cliente.cnpjCpf.replace(/[^\d]/g, ""),
            parcelamentos,
          });
        } catch (e) {
          console.error(
            `❌ Erro ao consultar cliente $ {cliente.nome}:`,
            e.message
          );
        }
      }

      if (resultados.length) {
        await salvarParcelamentos(resultados, empresaId);
      }

      res.json({
        sucesso: true,
        mensagem: `Consulta concluída. Parcelamentos encontrados para ${resultados.length} clientes.`,
      });
    } catch (err) {
      console.error("❌ Erro ao processar clientes selecionados:", err.message);
      res.status(500).json({ error: "Erro interno ao processar os clientes." });
    }
  }
);

// 🔹 Rota para obter os parcelamentos já salvos no banco por empresaId
router.get("/api/parcelamentos/:empresaId", async (req, res) => {
  const empresaId = parseInt(req.params.empresaId);
  const page = parseInt(req.query.page);
  const limit = parseInt(req.query.limit);

  if (isNaN(empresaId)) {
    return res.status(400).json({ error: "empresaId inválido." });
  }

  try {
    // Se não há parâmetros de paginação, retorna todos os dados
    if (!page || !limit) {
      const [parcelamentos] = await db.query(
        `
        SELECT 
          p.id,
          c.id AS clienteId,           
          p.numero,
          p.status,
          p.vencimento,
          p.guia_pdf,
          c.razao_social AS cliente,
          c.cpf_cnpj AS cnpj,
          p.tipo
        FROM parcelamentos p
        JOIN clientes c ON p.cliente_id = c.id
        WHERE p.empresa_id = ?
        ORDER BY 
          CASE 
            WHEN LOWER(p.status) LIKE '%parcelamento%' THEN 0
            WHEN LOWER(p.status) LIKE '%encerrado%' THEN 1
            ELSE 2
          END,
          p.vencimento ASC
        `,
        [empresaId]
      );

      // Converter BLOB para Base64 antes de retornar
      const parcelamentosComBase64 = parcelamentos.map(p => {
        let base64 = null;
        if (p.guia_pdf) {
          if (Buffer.isBuffer(p.guia_pdf)) {
            base64 = p.guia_pdf.toString('base64');
          } else if (typeof p.guia_pdf === 'string') {
            // Já é string Base64
            base64 = p.guia_pdf;
          }
        }
        return {
          ...p,
          guia_pdf_base64: base64
        };
      });

      return res.json(parcelamentosComBase64);
    }

    // Se há parâmetros de paginação, aplica LIMIT e OFFSET
    const offset = (page - 1) * limit;
    
    const [parcelamentos] = await db.query(
      `
      SELECT 
        p.id,
        c.id AS clienteId,           
        p.numero,
        p.status,
        p.vencimento,
        p.guia_pdf,
        c.razao_social AS cliente,
        c.cpf_cnpj AS cnpj,
        p.tipo
      FROM parcelamentos p
      JOIN clientes c ON p.cliente_id = c.id
      WHERE p.empresa_id = ?
      ORDER BY 
        CASE 
          WHEN LOWER(p.status) LIKE '%parcelamento%' THEN 0
          WHEN LOWER(p.status) LIKE '%encerrado%' THEN 1
          ELSE 2
        END,
        p.vencimento ASC
      LIMIT ? OFFSET ?
      `,
      [empresaId, limit, offset]
    );

    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) as total FROM parcelamentos WHERE empresa_id = ?`,
      [empresaId]
    );

    // Converter BLOB para Base64 antes de retornar
    const parcelamentosComBase64 = parcelamentos.map(p => {
      let base64 = null;
      if (p.guia_pdf) {
        if (Buffer.isBuffer(p.guia_pdf)) {
          base64 = p.guia_pdf.toString('base64');
        } else if (typeof p.guia_pdf === 'string') {
          // Já é string Base64
          base64 = p.guia_pdf;
        }
      }
      return {
        ...p,
        guia_pdf_base64: base64
      };
    });

    res.json({
      data: parcelamentosComBase64,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("❌ Erro ao buscar parcelamentos salvos:", error.message);
    res.status(500).json({ error: "Erro ao consultar parcelamentos." });
  }
});


router.post(
  "/api/parcelamentos/:empresaId/:clienteId/:numeroParcelamento/emitir",
  async (req, res) => {
    const empresaId = parseInt(req.params.empresaId);
    const clienteId = parseInt(req.params.clienteId);
    const numero = req.params.numeroParcelamento;

    console.log("📥 Recebido POST para emitir guia manual");
    console.log("📌 Params:", { empresaId, clienteId, numero });

    try {
      const [[empresa]] = await db.query(
        "SELECT cnpj FROM empresas WHERE id = ?",
        [empresaId]
      );
      console.log("🏢 Empresa:", empresa);

      const [[cliente]] = await db.query(
        "SELECT cpf_cnpj as cnpjCpf FROM clientes WHERE id = ?",
        [clienteId]
      );
      console.log("👤 Cliente:", cliente);

      if (!empresa || !cliente) {
        console.error("❌ Empresa ou cliente não encontrados.");
        return res
          .status(404)
          .json({ error: "Empresa ou cliente não encontrados." });
      }

      const { emitirDASParcsn } = require("../services/parcelamentosService");

      const empresaCNPJ = empresa.cnpj.replace(/\D/g, "");
      const clienteCNPJ = cliente.cnpjCpf.replace(/\D/g, "");
      const anoMesAtual =
        new Date().getFullYear() * 100 + (new Date().getMonth() + 1);

      console.log("🚀 Emitindo DAS:", {
        empresaCNPJ,
        clienteCNPJ,
        anoMesAtual,
      });

      const guia = await emitirDASParcsn(empresaCNPJ, clienteCNPJ, anoMesAtual);

      if (!guia) {
        console.error("❌ guia retornou vazio ou undefined.");
        return res.status(500).json({ error: "Falha ao emitir DAS." });
      }

      console.log("📄 Guia emitida com sucesso. Atualizando banco de dados...");

      await db.query(
        `UPDATE parcelamentos SET guia_pdf = ? WHERE empresa_id = ? AND cliente_id = ? AND numero = ?`,
        [guia, empresaId, clienteId, numero]
      );

      console.log("✅ Guia atualizada no banco para o cliente", clienteId);
      res.json({ sucesso: true, guia });
    } catch (err) {
      console.error("❌ Erro ao emitir DAS manual:", err.message);
      console.trace("🔍 Stack trace:");
      res.status(500).json({ error: "Erro interno ao emitir guia." });
    }
  }
);

// NOVA ROTA - /api/parcelamentos/emitir/:id
router.post("/api/parcelamentos/emitir/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const { anoMes } = req.body;

  console.log("📥 Emitir guia por ID:", id, "para competência:", anoMes);

  if (isNaN(id)) {
    return res.status(400).json({ error: "ID inválido." });
  }

  if (!anoMes || isNaN(Number(anoMes)) || String(anoMes).length !== 6) {
    return res.status(400).json({ error: "Competência (anoMes) inválida." });
  }

  try {
    const [[registro]] = await db.query(
      `SELECT p.numero, p.cliente_id, p.empresa_id, c.cpf_cnpj AS cnpjCpf, c.razao_social AS cliente_nome, e.cnpj 
       FROM parcelamentos p 
       JOIN clientes c ON p.cliente_id = c.id 
       JOIN empresas e ON p.empresa_id = e.id 
       WHERE p.id = ?`,
      [id]
    );

    if (!registro) {
      return res.status(404).json({ error: "Registro de parcelamento não encontrado." });
    }

    const { emitirDASParcsn } = require("../services/parcelamentosService");
    const empresaCNPJ = registro.cnpj.replace(/\D/g, "");
    const clienteCNPJ = registro.cnpjCpf.replace(/\D/g, "");

    const guia = await emitirDASParcsn(empresaCNPJ, clienteCNPJ, Number(anoMes));

    if (!guia) {
      return res.status(200).json({
        sucesso: false,
        cliente: registro.cliente_nome,
        mensagens: [
          {
            texto: "A guia não foi emitida. Verifique se a parcela já foi paga ou se ainda não está disponível."
          }
        ]
      });
    }

    await db.query(
      `UPDATE parcelamentos SET guia_pdf = ? WHERE id = ?`,
      [guia, id]
    );

    res.json({ sucesso: true, guia });
  } catch (err) {
    console.error("❌ Erro ao emitir guia por ID:", err);
    res.status(500).json({ error: "Erro interno ao emitir guia." });
  }
});

router.get("/api/parcelamentos/:empresaId/resumo", async (req, res) => {
  const empresaId = parseInt(req.params.empresaId);

  try {
    const [rows] = await db.query(
      `
      SELECT status FROM parcelamentos WHERE empresa_id = ?
    `,
      [empresaId]
    );

let ativo = 0, encerrado = 0, outros = 0;

for (const row of rows) {
  const status = row.status.toLowerCase();

  if (status.includes("em parcelamento")) ativo++;
  else if (status.includes("encerrado") || status.includes("sem efeito")) encerrado++;
  else outros++;
}

    res.json({ ativo, encerrado, outros });
  } catch (err) {
    console.error("Erro ao buscar resumo:", err.message);
    res.status(500).json({ error: "Erro ao buscar resumo" });
  }
});


module.exports = router;
