const { consultarServico } = require("./consultarService");
const { emitirRelatorio } = require("./emitirService");
const db = require("../../config/database");
const {
  obterTokenProcurador,
  armazenarTokenNoCache,
  autenticarViaCertificado
} = require("./authprocuradorService");


const ID_SISTEMA = "PARCSN";
const SERVICO_SIMPLENACIONAL = "PEDIDOSPARC163";
const CNPJ_CONTRATANTE = "17422651000172";



function cnpjEhValido(cnpj) {
    return typeof cnpj === "string" && /^\d{14}$/.test(cnpj);
}

function formatarDataNumerica(data) {
    if (!data || data.toString().length !== 8) return null;
    const str = data.toString();
    return `${str.slice(0, 4)}-${str.slice(4, 6)}-${str.slice(6, 8)}`;

    
}

async function consultarParcelamentosPorEmpresaId(empresaId) {
  console.log(`🔍 [INÍCIO] Consultando parcelamentos para empresaId = ${empresaId}`);
  const resultados = [];

  const [empresas] = await db.execute(
    "SELECT cnpj, razaoSocial FROM empresas WHERE id = ?",
    [empresaId]
  );

  const empresa = empresas[0];
  if (!empresa) {
    console.error(`❌ Empresa com ID ${empresaId} não encontrada no banco.`);
    throw new Error(`Empresa com ID ${empresaId} não encontrada.`);
  }
  console.log(`🏢 Empresa encontrada:`, empresa);

  const [clientes] = await db.execute(
    "SELECT id, nome, cnpjCpf FROM clientes WHERE empresaId = ?",
    [empresaId]
  );

  console.log(`👥 Clientes encontrados: ${clientes.length}`);

  for (const cliente of clientes) {
    const cnpj = cliente.cnpjCpf?.replace(/[^\d]/g, "");
    console.log(`➡️ Consultando cliente: ${cliente.nome} | CNPJ: ${cnpj}`);

    if (!cnpjEhValido(cnpj)) {
      console.warn(`⚠️ CNPJ inválido para cliente ${cliente.nome}: ${cnpj}`);
      continue;
    }

    try {
      const resultado = await consultarServico(
        "17422651000172",
        empresa.cnpj,
        cnpj,
        ID_SISTEMA,
        SERVICO_SIMPLENACIONAL
      );

      let dadosParcelamento = resultado?.dados;

      if (typeof dadosParcelamento === "string" && dadosParcelamento.trim()) {
        try {
          dadosParcelamento = JSON.parse(dadosParcelamento);
        } catch (e) {
          console.warn(`⚠️ Erro ao parsear 'dados' para ${cliente.nome}`);
          continue;
        }
      }

      const parcelamentos = dadosParcelamento?.parcelamentos || [];

      console.log(`📦 API => ${cliente.nome} retornou ${parcelamentos.length} parcelamentos`);
      if (parcelamentos.length === 0) {
        console.log("📭 Nenhum parcelamento encontrado nesta resposta:", JSON.stringify(dadosParcelamento, null, 2));
      }

      resultados.push({
        clienteId: cliente.id,
        nome: cliente.nome,
        cnpj,
        parcelamentos
      });

    } catch (error) {
      console.error(`❌ Erro na consulta do cliente ${cliente.nome}:`, error.message);
    }
  }

  console.log("✅ [FIM] Consulta concluída para empresaId:", empresaId);
  return { resultados, empresaInfo: empresa };
}


async function salvarParcelamentos(parcelamentosPorCliente, empresaId, empresaCNPJ) {
  console.log(`📥 Entrou em salvarParcelamentos: ${parcelamentosPorCliente.length} clientes | empresaCNPJ: ${empresaCNPJ}`);

  if (!empresaCNPJ) {
    console.warn("⚠️ empresaCNPJ veio como undefined. Buscando do banco usando empresaId:", empresaId);

    try {
      const [[empresa]] = await db.query(`SELECT cnpj FROM empresas WHERE id = ?`, [empresaId]);

      if (empresa?.cnpj) {
        empresaCNPJ = empresa.cnpj;
        console.log("✅ empresaCNPJ recuperado do banco:", empresaCNPJ);
      } else {
        console.error("❌ Não foi possível recuperar o CNPJ da empresa com id =", empresaId);
        throw new Error("CNPJ da empresa não encontrado.");
      }
    } catch (e) {
      console.error("❌ Erro ao buscar o CNPJ da empresa no banco:", e.message);
      return; // ou throw, se preferir abortar
    }
  }

  for (const cliente of parcelamentosPorCliente) {
    const { clienteId, nome, parcelamentos, cnpj } = cliente;

    if (!Array.isArray(parcelamentos) || parcelamentos.length === 0) {
      console.log(`📭 Sem parcelamentos para ${nome} (${clienteId})`);
      continue;
    }

    for (const p of parcelamentos) {
      const numero = p.numero != null ? p.numero.toString() : "000";
      const vencimento = formatarDataNumerica(p.dataDoPedido);
      const status = p.situacao || "Sem status";

      console.log(`📝 Salvando parcelamento:`, {
        clienteId,
        empresaId,
        numero,
        status,
        vencimento
      });

      try {
        await db.execute(
          `INSERT INTO parcelamentos (
            cliente_id, empresa_id, tipo, status, valor_total,
            parcelas, vencimento, data_atualizacao, criado_em, numero
          ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), ?)`,
          [
            clienteId,
            empresaId,
            "simples_nacional",
            status,
            0,
            0,
            vencimento || new Date(),
            numero
          ]
        );

        const hoje = new Date();
        const anoMesAtual = hoje.getFullYear() * 100 + (hoje.getMonth() + 1);

        console.log(`🚨 Emitir DAS => empresaCNPJ: ${empresaCNPJ}, clienteCNPJ: ${cnpj}, anoMes: ${anoMesAtual}`);

        const guiaPdfBase64 = await emitirDASParcsn(empresaCNPJ, cnpj, anoMesAtual);

        if (guiaPdfBase64) {
          await db.execute(
            `UPDATE parcelamentos SET guia_pdf = ? 
             WHERE cliente_id = ? AND numero = ? AND empresa_id = ?`,
            [guiaPdfBase64, clienteId, numero, empresaId]
          );
          console.log(`📄 DAS emitido e salvo para cliente ${nome} - nº ${numero}`);
        }

        console.log(`✅ Parcelamento ${numero} salvo com sucesso.`);

      } catch (error) {
        console.error(`❌ Erro ao salvar ${nome} (${clienteId}):`, error);
        console.trace("🔍 Stack trace do erro");
      }
    }
  }
}


async function processarParcelamentosPorEmpresaId(empresaId) {
  console.log("🚀 Iniciando processarParcelamentosPorEmpresaId para empresa:", empresaId);

const { resultados, empresaInfo } = await consultarParcelamentosPorEmpresaId(empresaId);
const empresaCNPJ = empresaInfo?.cnpj;

if (!empresaCNPJ) {
  throw new Error(`❌ CNPJ da empresa não encontrado para empresaId ${empresaId}. Verifique a tabela empresas.`);
}

  for (const cliente of resultados) {
    const { clienteId, nome, cnpj, parcelamentos } = cliente;

    try {
      if (!parcelamentos || parcelamentos.length === 0) {
        console.log(`📭 Cliente ${nome} não possui parcelamentos válidos.`);
        continue;
      }

console.log("🧭 Chamada para salvarParcelamentos:");
console.log("   ➤ empresaId:", empresaId);
console.log("   ➤ empresaCNPJ:", empresaCNPJ);
console.log("   ➤ cliente:", cliente.nome, "| CNPJ:", cliente.cnpj);
      await salvarParcelamentos([cliente], empresaId, empresaCNPJ);

    } catch (error) {
      console.error(`❌ Erro ao processar ${nome} (${cnpj}):`, error.message);
    }
  }

  console.log("✅ Finalizado processarParcelamentosPorEmpresaId para empresa:", empresaId);
}

  

async function emitirDASParcsn(empresaCNPJ, clienteCNPJ, anoMes) {
  try {
    console.log("🚀 Iniciando emissão de DAS PARCSN...");
    console.log("🔎 empresaCNPJ:", empresaCNPJ);
    console.log("🔎 clienteCNPJ:", clienteCNPJ);
    console.log("🔎 anoMes:", anoMes);

    const { accessToken, jwtToken } = await require('./authService').obterToken();
    console.log("✅ Token principal obtido com sucesso");

    const headers = {
      Authorization: `Bearer ${accessToken}`,
      jwt_token: jwtToken,
      'Content-Type': 'application/json'
    };

    if (empresaCNPJ !== CNPJ_CONTRATANTE) {
      console.log("🔐 Empresa ≠ Contratante, verificando token do procurador...");
      let procuradorToken = obterTokenProcurador(empresaCNPJ);
      console.log("🔐 Procurador token cache:", procuradorToken);

      if (!procuradorToken) {
        const cnpjLimpo = (empresaCNPJ || "").replace(/\D/g, "");
        console.log("🔍 [DEBUG] CNPJ original:", empresaCNPJ);
        console.log("🔍 [DEBUG] CNPJ limpo:", cnpjLimpo);
        
        // Tentar primeiro com CNPJ limpo (apenas números)
        let [[empresa]] = await db.query(
          `SELECT razaoSocial AS nome FROM empresas WHERE cnpj = ?`, 
          [cnpjLimpo]
        );
        
        // Se não encontrou, tentar com CNPJ formatado
        if (!empresa) {
          const cnpjFormatado = cnpjLimpo.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
          console.log("🔍 [DEBUG] Tentando CNPJ formatado:", cnpjFormatado);
          [[empresa]] = await db.query(
            `SELECT razaoSocial AS nome FROM empresas WHERE cnpj = ?`, 
            [cnpjFormatado]
          );
        }
        
        console.log("🏢 Empresa consultada:", empresa);
        console.log("🏢 Nome da empresa:", empresa?.nome);

        if (!empresa || !empresa.nome) {
          throw new Error(`❌ Nome da empresa não encontrado para o CNPJ ${empresaCNPJ}`);
        }

        procuradorToken = await autenticarViaCertificado(clienteCNPJ, empresaCNPJ, empresa.nome);
        console.log("🔑 Token retornado da autenticação via certificado:", procuradorToken);

        if (procuradorToken?.procuradorToken) {
          armazenarTokenNoCache(`procurador_token_${empresaCNPJ}`, procuradorToken.procuradorToken);
          procuradorToken = procuradorToken.procuradorToken;
        } else {
          throw new Error(`❌ Erro ao obter o token do procurador para ${empresaCNPJ}`);
        }
      }

      headers["autenticar_procurador_token"] = procuradorToken;
    }

    const payload = {
      contratante: { numero: CNPJ_CONTRATANTE, tipo: 2 },
      autorPedidoDados: { numero: empresaCNPJ, tipo: 2 },
      contribuinte: { numero: clienteCNPJ, tipo: 2 },
      pedidoDados: {
        idSistema: "PARCSN",
        idServico: "GERARDAS161",
        versaoSistema: "1.0",
        dados: JSON.stringify({ parcelaParaEmitir: anoMes })
      }
    };

    console.log("📦 Payload pronto:", JSON.stringify(payload, null, 2));
    console.log("📤 Enviando requisição para emitir DAS PARCSN...");

    const response = await require('axios').post(
      'https://gateway.apiserpro.serpro.gov.br/integra-contador/v1/Emitir',
      payload,
      { headers }
    );

    console.log("📥 Resposta recebida:", response.status, response.statusText);
    console.log("📨 Corpo da resposta completa (response.data):", JSON.stringify(response.data, null, 2));

    const retorno = response.data?.dados ? JSON.parse(response.data.dados) : null;

    if (retorno?.docArrecadacaoPdfB64) {
      console.log("✅ Guia gerada com sucesso!");
      return retorno.docArrecadacaoPdfB64;
    } else {
      console.warn("⚠️ A guia foi recebida, mas 'docArrecadacaoPdfB64' está vazio ou ausente.");
      return null;
    }

  } catch (err) {
    console.error("❌ Erro ao emitir DAS:");
    if (err.response) {
      console.error("📛 Erro na requisição (status):", err.response.status);
      console.error("📛 Erro na resposta:", JSON.stringify(err.response.data, null, 2));
    } else if (err.request) {
      console.error("📛 Erro na requisição sem resposta:", err.request);
    } else {
      console.error("📛 Erro ao configurar a requisição:", err.message);
    }
    return null;
  }
}

module.exports = {
  consultarParcelamentosPorEmpresaId,
  salvarParcelamentos, emitirDASParcsn,
  processarParcelamentosPorEmpresaId,
};
