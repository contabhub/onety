const express = require("express");
const router = express.Router();
const db = require("../../config/database");
const { solicitarProtocolo } = require("../../services/gestao/apoioService");
const { emitirRelatorio } = require("../../services/gestao/emitirService");
const { extrairTextoDeBase64, analisarSituacao } = require("../../services/gestao/sitfisService"); // Importando as funções do serviço



// 🔹 Endpoint para processar Situação Fiscal de todos os clientes da empresa
router.post("/:empresaId", async (req, res) => {
    const { empresaId } = req.params;
    const contratanteNumero = "17422651000172"; // CF RJ SEMPRE

    try {
        // 🔹 Buscar CNPJ da empresa
        const [empresa] = await db.execute(
            "SELECT cnpj FROM empresas WHERE id = ?", [empresaId]
        );

        if (empresa.length === 0) {
            return res.status(404).json({ error: "Empresa não encontrada" });
        }

        const autorPedidoNumero = empresa[0].cnpj;

        // 🔹 Buscar todos os clientes da empresa
    const [clientes] = await db.execute(
      `SELECT id, cpf_cnpj FROM clientes WHERE empresa_id = ?`, [empresaId]
    );

        if (clientes.length === 0) {
            return res.status(404).json({ error: "Nenhum cliente encontrado para essa empresa." });
        }

        let resultados = [];
        let temErroCertificado = false;
        let erroCertificado = "";

        for (const cliente of clientes) {
      const clienteId = cliente.id;
      const cnpjContribuinte = cliente.cpf_cnpj;

            // 🔒 Bloqueio: Verifica se já existe um relatório neste mês para o cliente
            const [registroExistente] = await db.execute(
                `SELECT * FROM sitfis 
                 WHERE empresa_id = ? 
                 AND cliente_id = ?
                 AND MONTH(data_criacao) = MONTH(CURRENT_DATE())
                 AND YEAR(data_criacao) = YEAR(CURRENT_DATE())`,
                [empresaId, clienteId]
            );

            if (registroExistente.length > 0) {
                console.log(`⏭️ Cliente ${clienteId} já possui SitFis no mês. Não inicia SERPRO.`);
                resultados.push({ clienteId, status: "ja_consultado_mes" });
                continue;
            }

            try {
                console.log(`🔄 Consultando Situação Fiscal do cliente ${clienteId}...`);

        // Passo 1: Solicitar protocolo
        const consulta = await solicitarProtocolo(
          contratanteNumero, autorPedidoNumero, cnpjContribuinte, "SITFIS", "SOLICITARPROTOCOLO91"
      );

      const { protocolo } = consulta;

      if (!protocolo) throw new Error("Protocolo não encontrado.");

      // Passo 2: Emitir relatório
      const emissao = await emitirRelatorio(
          protocolo, contratanteNumero, autorPedidoNumero, cnpjContribuinte
      );

      if (!emissao || !emissao.base64) throw new Error("Erro ao emitir relatório.");

      // Passo 3: Extrair texto e determinar status
      const textoExtraido = await extrairTextoDeBase64(emissao.base64);
      const { status, descricao } = analisarSituacao(textoExtraido);

      await db.execute(
          "INSERT INTO sitfis (cliente_id, empresa_id, binary_file, status, pendencias, data_criacao) VALUES (?, ?, ?, ?, ?, NOW())",
          [clienteId, empresaId, emissao.base64, status, descricao]
      );

      console.log(`✅ Cliente ${clienteId} processado com sucesso.`);
      resultados.push({ clienteId, status: "processado" });

  } catch (clienteErro) {
      console.error(`❌ Erro ao processar cliente ${clienteId}:`, clienteErro.message);
      resultados.push({ clienteId, status: "erro", error: clienteErro.message });
      
                     // Verificar se é erro de certificado
        console.log("🔍 [BACKEND DEBUG] Verificando erro:", clienteErro.message);
        if (clienteErro.message.includes("certificado") || 
            clienteErro.message.includes("Certificado") || 
            clienteErro.message.includes("não encontrados") ||
            clienteErro.message.includes("token do procurador")) {
            console.log("🔍 [BACKEND DEBUG] Erro de certificado detectado!");
            temErroCertificado = true;
            erroCertificado = clienteErro.message;
        }
  }
}

// Se houve erro de certificado, retornar erro
console.log("🔍 [BACKEND DEBUG] temErroCertificado:", temErroCertificado);
console.log("🔍 [BACKEND DEBUG] erroCertificado:", erroCertificado);

if (temErroCertificado) {
    console.log("🔍 [BACKEND DEBUG] Retornando erro 400 para certificado");
    return res.status(400).json({ 
        error: "Erro de certificado detectado",
        message: erroCertificado,
        empresaId,
        totalClientes: clientes.length,
        resultados
    });
}

res.json({
  empresaId,
  totalClientes: clientes.length,
  resultados
});

} catch (error) {
console.error("❌ Erro geral ao processar Situação Fiscal:", error.message);
res.status(500).json({ error: "Erro geral ao processar Situação Fiscal" });
}
});


//Rota para BUSCAR as sitfis do BD e devolver para o Front. 
router.get("/:empresaId", async (req, res) => {
    const { empresaId } = req.params;
  
    try {
      const [rows] = await db.execute(
        `SELECT status, COUNT(*) AS total 
         FROM sitfis 
         WHERE empresa_id = ? 
           AND MONTH(data_criacao) = MONTH(CURRENT_DATE()) 
           AND YEAR(data_criacao) = YEAR(CURRENT_DATE())
         GROUP BY status`,
        [empresaId]
      );
  
      res.json(rows); // será um array de objetos: [{ status: 'Regular', total: 9 }, ...]
    } catch (error) {
      console.error("❌ Erro ao buscar resumo SitFis:", error.message);
      res.status(500).json({ error: "Erro ao buscar resumo Situação Fiscal" });
    }
  });

  // 🔍 Nova rota para retornar todas as Situações Fiscais Detalhadas da empresa
router.get("/detalhado/:empresaId", async (req, res) => {
  const { empresaId } = req.params;
  const { periodo } = req.query;

  let whereData = "";

  switch (periodo) {
    case "Mês atual":
      whereData = `AND MONTH(s.data_criacao) = MONTH(CURRENT_DATE())
                   AND YEAR(s.data_criacao) = YEAR(CURRENT_DATE())`;
      break;
    case "Último mês":
      whereData = `AND MONTH(s.data_criacao) = MONTH(CURRENT_DATE() - INTERVAL 1 MONTH)
                   AND YEAR(s.data_criacao) = YEAR(CURRENT_DATE() - INTERVAL 1 MONTH)`;
      break;
    case "Trimestre atual":
      whereData = `AND QUARTER(s.data_criacao) = QUARTER(CURRENT_DATE())
                   AND YEAR(s.data_criacao) = YEAR(CURRENT_DATE())`;
      break;
    case "Ano atual":
      whereData = `AND YEAR(s.data_criacao) = YEAR(CURRENT_DATE())`;
      break;
    case "Último trimestre":
      whereData = `AND QUARTER(s.data_criacao) = QUARTER(CURRENT_DATE() - INTERVAL 3 MONTH)
                   AND YEAR(s.data_criacao) = YEAR(CURRENT_DATE() - INTERVAL 3 MONTH)`;
      break;
    case "Últimos 7 dias":
      whereData = `AND s.data_criacao >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)`;
      break;
    case "Hoje":
      whereData = `AND DATE(s.data_criacao) = CURDATE()`;
      break;
    case "Passado":
      whereData = `AND s.data_criacao < CURDATE()`;
      break;
    case "Futuro":
      whereData = `AND s.data_criacao > CURDATE()`;
      break;
    case "Todos":
    default:
      whereData = ""; // sem filtro
      break;
  }

  try {
    const [dados] = await db.execute(
      `SELECT 
        c.id AS cliente_id,
        c.cpf_cnpj AS cnpj,
        c.razao_social AS nome,
        s.status,
        s.pendencias,
        s.data_criacao,
        s.binary_file
      FROM sitfis s
      JOIN clientes c ON s.cliente_id = c.id
      WHERE s.empresa_id = ?
      ${whereData}
      ORDER BY s.data_criacao DESC`,
      [empresaId]
    );
    // Debug: verificar presença de arquivos
    try {
      const total = Array.isArray(dados) ? dados.length : 0;
      const comArquivo = (dados || []).filter(r => !!r.binary_file).length;
      const amostras = (dados || [])
        .slice(0, 3)
        .map(r => ({ id: r.cliente_id, len: r.binary_file ? String(r.binary_file).length : 0 }));
      console.log(`[SITFIS][DETALHADO] empresa ${empresaId} periodo="${periodo || 'Todos'}" total=${total} comArquivo=${comArquivo} amostras=`, amostras);
    } catch {}

    res.json(dados);
  } catch (error) {
    console.error("❌ Erro ao buscar Situação Fiscal detalhada:", error.message);
    res.status(500).json({ error: "Erro ao buscar Situação Fiscal detalhada" });
  }
});

  
  // 🔹 Endpoint para processar Situação Fiscal de clientes selecionados
router.post("/:empresaId/clientes-selecionados", async (req, res) => {
  const { empresaId } = req.params;
  const { clientesSelecionados } = req.body; // array com IDs dos clientes selecionados
  const contratanteNumero = "17422651000172";

  if (!Array.isArray(clientesSelecionados) || clientesSelecionados.length === 0) {
    return res.status(400).json({ error: "Nenhum cliente selecionado." });
  }

  try {
    const [empresa] = await db.execute("SELECT cnpj FROM empresas WHERE id = ?", [empresaId]);
    if (empresa.length === 0) {
      return res.status(404).json({ error: "Empresa não encontrada" });
    }

    const autorPedidoNumero = empresa[0].cnpj;

    let resultados = [];
    let temErroCertificado = false;
    let erroCertificado = "";

    for (const clienteId of clientesSelecionados) {
      console.log(`[SITFIS] ▶️ Iniciando processamento do cliente ${clienteId} (empresa ${empresaId}) em ${new Date().toLocaleString('pt-BR')}`);
      const [clienteData] = await db.execute("SELECT cpf_cnpj FROM clientes WHERE id = ? AND empresa_id = ?", [clienteId, empresaId]);
      if (clienteData.length === 0) {
        resultados.push({ clienteId, status: "cliente não encontrado" });
        continue;
      }

      const cnpjContribuinte = clienteData[0].cpf_cnpj;

      // Verifica se já consultado no mês
      const [registroExistente] = await db.execute(
        `SELECT * FROM sitfis WHERE empresa_id = ? AND cliente_id = ? AND MONTH(data_criacao) = MONTH(CURRENT_DATE()) AND YEAR(data_criacao) = YEAR(CURRENT_DATE())`,
        [empresaId, clienteId]
      );

      if (registroExistente.length > 0) {
        console.log(`[SITFIS] ⛔ BLOQUEADO (já existe SitFis no mês). Cliente ${clienteId} | Empresa ${empresaId} | Registro: ${registroExistente[0].id} | Data: ${new Date(registroExistente[0].data_criacao).toLocaleString('pt-BR')}`);
        resultados.push({ clienteId, status: "ja_consultado_mes", registroId: registroExistente[0].id, data: registroExistente[0].data_criacao });
        continue;
      }

      try {
        console.log(`[SITFIS] 🚀 Iniciando chamada ao SERPRO para cliente ${clienteId} (empresa ${empresaId})`);
        const consulta = await solicitarProtocolo(contratanteNumero, autorPedidoNumero, cnpjContribuinte, "SITFIS", "SOLICITARPROTOCOLO91");
        const { protocolo } = consulta;
        if (!protocolo) throw new Error("Protocolo não encontrado.");

        const emissao = await emitirRelatorio(protocolo, contratanteNumero, autorPedidoNumero, cnpjContribuinte);
        if (!emissao || !emissao.base64) throw new Error("Erro ao emitir relatório.");

        const textoExtraido = await extrairTextoDeBase64(emissao.base64);
        const { status, descricao } = analisarSituacao(textoExtraido);

        await db.execute(
          "INSERT INTO sitfis (cliente_id, empresa_id, binary_file, status, pendencias, data_criacao) VALUES (?, ?, ?, ?, ?, NOW())",
          [clienteId, empresaId, emissao.base64, status, descricao]
        );

        console.log(`[SITFIS] ✅ Processado com sucesso. Cliente ${clienteId} (empresa ${empresaId})`);
        resultados.push({ clienteId, status: "processado" });
      } catch (err) {
        resultados.push({ clienteId, status: "erro", error: err.message });
        
        // Verificar se é erro de certificado
        console.log("🔍 [BACKEND DEBUG] Verificando erro:", err.message);
        if (err.message.includes("certificado") || 
            err.message.includes("Certificado") || 
            err.message.includes("não encontrados") ||
            err.message.includes("token do procurador")) {
            console.log("🔍 [BACKEND DEBUG] Erro de certificado detectado!");
            temErroCertificado = true;
            erroCertificado = err.message;
        }
      }
    }

    // Se houve erro de certificado, retornar erro
    console.log("🔍 [BACKEND DEBUG] temErroCertificado:", temErroCertificado);
    console.log("🔍 [BACKEND DEBUG] erroCertificado:", erroCertificado);
    
    if (temErroCertificado) {
        console.log("🔍 [BACKEND DEBUG] Retornando erro 400 para certificado");
        return res.status(400).json({ 
            error: "Erro de certificado detectado",
            message: erroCertificado,
            empresaId,
            totalClientes: clientesSelecionados.length,
            resultados
        });
    }

    res.json({
      empresaId,
      totalClientes: clientesSelecionados.length,
      resultados,
    });
  } catch (error) {
    console.error("Erro geral ao processar Situação Fiscal:", error.message);
    res.status(500).json({ error: "Erro geral ao processar Situação Fiscal" });
  }
});

  
module.exports = router;
