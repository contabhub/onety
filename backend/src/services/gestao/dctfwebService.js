const { consultarServico } = require("./consultarService");
const { extrairDataTransmissao } = require("../../utils/gestao/extrairDataTransmissao");
const db = require("../config/db");

const MEU_CNPJ = "17422651000172"; // Substitua pelo CNPJ correto

async function consultarDCTFWeb(empresaId, clienteId, categoria, anoPA, mesPA) {
  const cnpjEmpresa = await obterCnpjEmpresa(empresaId);
  const cnpjCliente = await obterCnpjCliente(clienteId);
  const competencia = `${mesPA.toString().padStart(2, "0")}/${anoPA}`;

  try {
    const consulta = await consultarServico(
      MEU_CNPJ,
      cnpjEmpresa,
      cnpjCliente,
      "DCTFWEB",
      "CONSXMLDECLARACAO38",
      { categoria, anoPA, mesPA }
    );

    if (!consulta.dados) {
      const mensagemErro = extrairMensagemErro(consulta);
      throw new Error(mensagemErro || "❌ Consulta retornou sem dados.");
    }

    let dados = typeof consulta.dados === 'string'
      ? JSON.parse(typeof JSON.parse(consulta.dados) === 'string' ? JSON.parse(consulta.dados) : consulta.dados)
      : consulta.dados;

    const xmlBase64 = dados.XMLStringBase64;
    if (!xmlBase64 || !isBase64(xmlBase64)) {
      throw new Error("XML inválido ou ausente.");
    }

    // 🔍 Extrair a data de transmissão do XML
    const dataTransmissao = await extrairDataTransmissao(xmlBase64);

    // ✅ Salvar na tabela dctfweb
    await db.query(
      `INSERT INTO dctfweb (cliente_id, empresa_id, competencia, situacao, recibo, data_entrega, xml_base64, data_transmissao)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [clienteId, empresaId, competencia, "Em Andamento", "000", new Date(), xmlBase64, dataTransmissao]
    );

    // ✅ Atualizar obrigacoes_clientes
    await db.query(
      `UPDATE obrigacoes_clientes
       SET xml_base64 = ?, dataTransmissao = ?, status = 'concluida', baixadaAutomaticamente = 1, dataBaixa = NOW()
       WHERE clienteId = ? AND competencia = ? AND obrigacaoId = (
         SELECT id FROM obrigacoes WHERE codigo_receita = 'DCTFWeb' LIMIT 1
       )`,
      [xmlBase64, dataTransmissao, clienteId, competencia]
    );

    console.log(`✅ DCTFWeb ${competencia} salva para cliente ${clienteId}`);
    return true;

  } catch (error) {
    console.error("❌ Erro na consulta DCTFWeb:", error.message);
    return false;
  }
}

function isBase64(str) {
  try {
    return Buffer.from(str, 'base64').toString('base64') === str;
  } catch {
    return false;
  }
}

/**
 * 📌 Função para obter o CNPJ da empresa
 */
async function obterCnpjEmpresa(empresaId) {
  try {
    const [result] = await db.execute(
      `SELECT cnpj FROM empresas WHERE id = ?`,
      [empresaId]
    );

    if (result.length === 0) {
      throw new Error(`❌ Nenhuma empresa encontrada com ID ${empresaId}`);
    }

    return result[0].cnpj;
  } catch (error) {
    console.error("❌ Erro ao buscar CNPJ da empresa:", error);
    throw error;
  }
}

/**
 * 📌 Função para obter o CNPJ do cliente
 */
async function obterCnpjCliente(clienteId) {
  try {
    const [result] = await db.execute(
      `SELECT cnpjCpf FROM clientes WHERE id = ?`,
      [clienteId]
    );

    if (result.length === 0) {
      throw new Error(`❌ Nenhum cliente encontrado com ID ${clienteId}`);
    }

    const cnpjCliente = result[0].cnpjCpf;

    if (!cnpjCliente) {
      throw new Error(`❌ CNPJ do cliente ${clienteId} não encontrado ou está vazio.`);
    }

    console.log(`🔍 CNPJ do cliente ${clienteId}: ${cnpjCliente}`);
    return cnpjCliente;
  } catch (error) {
    console.error("❌ Erro ao buscar CNPJ do cliente:", error);
    throw error;
  }
}

/**
 * 📌 Função auxiliar para extrair uma mensagem de erro da resposta da API
 */
function extrairMensagemErro(consulta) {
  if (consulta && consulta.mensagens && Array.isArray(consulta.mensagens)) {
    return consulta.mensagens.map(m => m.texto).join(' | ');
  }
  return null;
}

module.exports = { consultarDCTFWeb };
