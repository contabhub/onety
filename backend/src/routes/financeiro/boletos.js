const express = require("express");
const router = express.Router();
const axios = require("axios");
const pool = require("../../config/database");
const https = require('https');
const { normalizarContaCorrente, detectarTipoPessoa } = require('../../services/financeiro/cnaeIbge');
// Usa AutomacaoRecorrencia quando existir; senão, busca o último token do banco
async function getInterToken() {
  try {
    const automacao = require('../../services/financeiro/automacaoRecorrencia');
    return await automacao.obterTokenInter();
  } catch (error) {
    console.log("⚠️ Erro ao obter token via AutomacaoRecorrencia, tentando buscar do banco...");
    
    try {
      const [[row]] = await pool.query(
        'SELECT access_token FROM inter_tokens ORDER BY criado_em DESC LIMIT 1'
      );
      if (!row || !row.access_token) {
        throw new Error('Token do Inter não encontrado. Gere/renove o token primeiro.');
      }
      return row.access_token;
    } catch (dbError) {
      console.error("❌ Erro ao buscar token do banco:", dbError.message);
      throw new Error('Token do Inter não encontrado. Gere/renove o token primeiro.');
    }
  }
}
function getHttpsAgent() {
  const cert = Buffer.from(process.env.INTER_CERT_B64, 'base64').toString('utf-8');
  const key  = Buffer.from(process.env.INTER_KEY_B64,  'base64').toString('utf-8');
  return new https.Agent({ cert, key });
}
// Normaliza campos de status e datas vindas da API do Inter,
// sem depender de nomes exatos (robustez contra variações)
function extrairCamposBoleto(api) {
  console.log("🔍 [DEBUG] API Response:", JSON.stringify(api, null, 2));
  
  // Extrair dados da estrutura aninhada da API do Inter
  const cobranca = api.cobranca || api;
  
  const sBruto = (cobranca.situacao || cobranca.status || api.situacao || api.status || '').toString().toUpperCase();
  console.log("🔍 [DEBUG] Status bruto:", sBruto);
  let sConsolidado = 'EM_ABERTO';
  if (['PAGO', 'RECEBIDO', 'LIQUIDADO'].includes(sBruto)) sConsolidado = 'PAGO';
  if (['CANCELADO', 'BAIXADO', 'EXPIRADO'].includes(sBruto)) sConsolidado = 'CANCELADO';
  
  console.log("🔍 [DEBUG] Status consolidado:", sConsolidado);
  // Mapear campos de valor recebido (API do Inter usa valorTotalRecebido)
  const valorRecebido = cobranca.valorTotalRecebido || cobranca.valorRecebido || cobranca.valorPago || api.valorRecebido || api.valorPago || null;
  console.log("🔍 [DEBUG] Valor recebido:", valorRecebido);
  
  // Mapear campos de data (API do Inter usa dataSituacao)
  const dataPagamento = cobranca.dataSituacao || cobranca.dataLiquidacao || cobranca.dataPagamento || cobranca.dataCredito || api.dataPagamento || api.dataCredito || null;
  console.log("🔍 [DEBUG] Data pagamento:", dataPagamento);
  
  const dataCancelamento = cobranca.dataCancelamento || cobranca.dataBaixa || api.dataCancelamento || api.dataBaixa || null;
  const motivoCancel = cobranca.motivoCancelamento || cobranca.motivoBaixa || api.motivoCancelamento || api.motivoBaixa || null;
  return {
    statusBruto: sBruto || null,
    statusConsolidado: sConsolidado,
    valorRecebido,
    dataPagamento,
    dataCancelamento,
    motivoCancelamento: motivoCancel
  };
}
// Consulta o Inter, atualiza "boletos" e grava "boletos_historico" quando houver mudança
async function sincronizarUmBoletoPorCodigo(codigoSolicitacao) {
  // 1) Confere se o boleto existe localmente
  const [[boleto]] = await pool.query(
    'SELECT id, status FROM boletos WHERE codigo_solicitacao = ? LIMIT 1',
    [codigoSolicitacao]
  );
  if (!boleto) {
    throw new Error('Boleto não localizado no banco para o codigo_solicitacao informado.');
  }
  // 2) Chama a API do Inter com retry automático em caso de token expirado
  let access_token = await getInterToken();
  const agent = getHttpsAgent();
  const contaCorrente = normalizarContaCorrente(process.env.INTER_CONTA_CORRENTE || '269127208');
  let data;
  try {
    const response = await axios.get(
      `https://cdpj.partners.bancointer.com.br/cobranca/v3/cobrancas/${codigoSolicitacao}`,
      {
        headers: {
          Authorization: `Bearer ${access_token}`,
          'x-conta-corrente': contaCorrente
        },
        httpsAgent: agent
      }
    );
    data = response.data;
  } catch (error) {
    // Se der erro 401 (token expirado), regenerar token e tentar novamente
    if (error.response?.status === 401) {
      console.log("🔄 Token expirado, regenerando automaticamente...");
      
             try {
         // Importar a instância de automação para regenerar o token
         const automacao = require('../../services/financeiro/automacaoRecorrencia');
         
         // Regenerar token
         access_token = await automacao.gerarTokenInter();
        console.log("✅ Novo token gerado com sucesso");
        
        // Tentar novamente com o novo token
        const retryResponse = await axios.get(
          `https://cdpj.partners.bancointer.com.br/cobranca/v3/cobrancas/${codigoSolicitacao}`,
          {
            headers: {
              Authorization: `Bearer ${access_token}`,
              'x-conta-corrente': contaCorrente
            },
            httpsAgent: agent
          }
        );
        data = retryResponse.data;
        console.log("✅ Requisição realizada com sucesso após regeneração do token");
      } catch (retryError) {
        console.error("❌ Erro persistente mesmo após regeneração do token:", retryError.response?.data || retryError.message);
        throw new Error(`Erro ao consultar boleto no Inter: ${retryError.response?.data?.message || retryError.message}`);
      }
    } else {
      // Se não for erro 401, re-throw o erro original
      console.error("❌ Erro na consulta ao Inter:", error.response?.data || error.message);
      throw new Error(`Erro ao consultar boleto no Inter: ${error.response?.data?.message || error.message}`);
    }
  }
  // 3) Normaliza campos e atualiza a tabela "boletos"
  const campos = extrairCamposBoleto(data);
  
  console.log("🔍 [DEBUG] Campos extraídos:", JSON.stringify(campos, null, 2));
  await pool.query(
    `UPDATE boletos
       SET status = COALESCE(?, status),
           valor_recebido = ?,
           data_pagamento = ?,
           data_cancelamento = ?,
           motivo_cancelamento = ?
     WHERE id = ?`,
    [
      campos.statusBruto,
      campos.valorRecebido,
      campos.dataPagamento,
      campos.dataCancelamento,
      campos.motivoCancelamento,
      boleto.id
    ]
  );
  // 4) Grava histórico somente se houve mudança de status
  const statusAnterior = (boleto.status || null);
  const statusAtual    = (campos.statusBruto || null);
  if (statusAnterior !== statusAtual) {
    await pool.query(
      `INSERT INTO boletos_historico
         (boleto_id, codigo_solicitacao, status_anterior, status_atual, payload, data_evento)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        boleto.id,
        codigoSolicitacao,
        statusAnterior,
        statusAtual,
        JSON.stringify(data),
        campos.dataPagamento || campos.dataCancelamento || null
      ]
    );
  }
  return { situacao: campos.statusConsolidado, statusBruto: campos.statusBruto };
}
router.post("/cobranca", async (req, res) => {
  const { conta_corrente, numeroVenda, valorNominal, dataVencimento, numDiasAgenda, pagador, formasRecebimento, mensagem, empresa_id, contrato_id } = req.body;
  
  try {
    // Buscar conta Inter configurada para a empresa
    let empresaId = empresa_id || 1; // Usar empresa_id da requisição ou padrão
    
    // Primeiro tentar buscar na tabela inter_accounts
    let [[contaInter]] = await pool.query(
      `SELECT * FROM inter_accounts 
       WHERE empresa_id = ? AND status = 'ativo' 
       ORDER BY is_default DESC, id ASC 
       LIMIT 1`,
      [companyId]
    );

    // Se não encontrou, buscar na tabela contas_api
    if (!contaInter) {
      [[contaInter]] = await pool.query(
        `SELECT 
           id,
           empresa_id,
           inter_apelido as apelido,
           inter_conta_corrente as conta_corrente,
           inter_client_id as client_id,
           inter_client_secret as client_secret,
           inter_cert_b64 as cert_b64,
           inter_key_b64 as key_b64,
           inter_ambiente as ambiente,
           inter_is_default as is_default,
           inter_status as status
         FROM contas_api 
         WHERE empresa_id = ? AND inter_enabled = TRUE AND inter_status = 'ativo'
         ORDER BY inter_is_default DESC, id ASC 
         LIMIT 1`,
        [companyId]
      );
    }

    if (!contaInter) {
      return res.status(400).json({ error: `Nenhuma conta Inter configurada para a empresa ${companyId}. Configure uma conta em /contas-api ou /inter-accounts.` });
    }

    console.log(`🏦 Usando conta Inter: ${contaInter.apelido || contaInter.conta_corrente}`);

    // Gerar token usando as credenciais da conta
    const automacao = require('../../services/financeiro/automacaoRecorrencia');
    const access_token = await automacao.gerarTokenInterComCredenciais(contaInter);

    // Configurar agente HTTPS com as credenciais da conta
    const cert = Buffer.from(contaInter.cert_b64, 'base64').toString('utf-8');
    const key = Buffer.from(contaInter.key_b64, 'base64').toString('utf-8');
    const agent = new (require('https').Agent)({ cert, key });

    // Usar conta corrente da conta configurada se não foi fornecida (normalizada)
    const contaCorrenteFinal = normalizarContaCorrente(conta_corrente || contaInter.conta_corrente);
    // Garante que numeroVenda tenha no máximo 15 caracteres
    let numeroVendaFinal = numeroVenda;
    if (typeof numeroVendaFinal === 'string' && numeroVendaFinal.length > 15) {
      numeroVendaFinal = numeroVendaFinal.slice(0, 15);
    }
    // Monta o objeto do boleto conforme a documentação do Inter
    const boletoData = {
      seuNumero: numeroVendaFinal,
      valorNominal,
      dataVencimento,
      numDiasAgenda,
      pagador,
      formasRecebimento,
      mensagem
    };
    // URL base baseada no ambiente
    const baseUrl = contaInter.ambiente === 'hml' 
      ? 'https://cdp.partners.bancointer.com.br' 
      : 'https://cdpj.partners.bancointer.com.br';

    // Cria o boleto
    const response = await axios.post(
      `${baseUrl}/cobranca/v3/cobrancas`,
      boletoData,
      {
        headers: {
          "Authorization": `Bearer ${access_token}`,
          "x-conta-corrente": contaCorrenteFinal,
          "Content-Type": "application/json"
        },
        httpsAgent: agent,
      }
    );
    // Salva no banco os principais campos do boleto
    const { linkBoleto, codigoBarras, dataEmissao, dataVencimento: dataVenc, status, codigoSolicitacao } = response.data;
    
    // Garantir que a data de vencimento esteja no formato correto para o banco
    let dataVencimentoFinal = dataVenc || dataVencimento;
    if (dataVencimentoFinal instanceof Date) {
      dataVencimentoFinal = dataVencimentoFinal.toISOString().split('T')[0];
    } else if (typeof dataVencimentoFinal === 'string' && dataVencimentoFinal.includes('T')) {
      dataVencimentoFinal = dataVencimentoFinal.split('T')[0];
    }
    const [boletoResult] = await pool.query(
      `INSERT INTO boletos 
        (link_boleto, codigo_barras, data_emissao, data_vencimento, status, numero_venda, valor, pagador_nome, pagador_cpf_cnpj, pagador_email, codigo_solicitacao, inter_conta_id, contrato_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        linkBoleto,
        codigoBarras,
        dataEmissao,
        dataVencimentoFinal,
        status,
        numeroVendaFinal, // garantir que está usando o numeroVenda final
        valorNominal,
        pagador?.nome || null,
        pagador?.cpfCnpj || null,
        pagador?.email || null,
        codigoSolicitacao || null,
        contaInter.id, // inter_conta_id
        contrato_id || null
      ]
    );
    const boletoId = boletoResult.insertId;
    res.json({
      ...response.data,
      insertId: boletoId
    });
  } catch (error) {
    console.error("Erro ao criar boleto Inter:", error.response?.data || error.message);
    res.status(500).json({ error: error.response?.data || "Erro ao criar boleto Inter." });
  }
});
router.get('/consulta/:codigoSolicitacao', async (req, res) => {
  const { codigoSolicitacao } = req.params;
  
  try {
    // Buscar o boleto para obter o inter_conta_id
    const [[boleto]] = await pool.query(
      'SELECT inter_conta_id FROM boletos WHERE codigo_solicitacao = ? LIMIT 1',
      [codigoSolicitacao]
    );

    if (!boleto || !boleto.inter_conta_id) {
      return res.status(404).json({ error: 'Boleto não encontrado ou sem inter_conta_id configurado' });
    }

    // Buscar a conta Inter
    let [[contaInter]] = await pool.query(
      'SELECT * FROM inter_accounts WHERE id = ? AND status = "ativo"',
      [boleto.inter_conta_id]
    );

    // Se não encontrou na inter_accounts, buscar na contas_api
    if (!contaInter) {
      [[contaInter]] = await pool.query(
        `SELECT 
           id,
           inter_apelido as apelido,
           inter_conta_corrente as conta_corrente,
           inter_client_id as client_id,
           inter_client_secret as client_secret,
           inter_cert_b64 as cert_b64,
           inter_key_b64 as key_b64,
           inter_ambiente as ambiente
         FROM contas_api 
         WHERE id = ? AND inter_enabled = TRUE AND inter_status = 'ativo'`,
        [boleto.inter_conta_id]
      );
    }

    if (!contaInter) {
      return res.status(404).json({ error: 'Conta Inter não encontrada ou inativa' });
    }

    // Gerar token usando as credenciais da conta
    const automacao = require('../../services/financeiro/automacaoRecorrencia');
    const access_token = await automacao.gerarTokenInterComCredenciais(contaInter);

    // Configurar agente HTTPS com as credenciais da conta
    const cert = Buffer.from(contaInter.cert_b64, 'base64').toString('utf-8');
    const key = Buffer.from(contaInter.key_b64, 'base64').toString('utf-8');
    const agent = new (require('https').Agent)({ cert, key });

    const contaCorrente = normalizarContaCorrente(contaInter.conta_corrente);

    // URL base baseada no ambiente
    const baseUrl = contaInter.ambiente === 'hml' 
      ? 'https://cdp.partners.bancointer.com.br' 
      : 'https://cdpj.partners.bancointer.com.br';

    const response = await axios.get(
      `${baseUrl}/cobranca/v3/cobrancas/${codigoSolicitacao}`,
      {
        headers: {
          "Authorization": `Bearer ${access_token}`,
          "x-conta-corrente": contaCorrente,
        },
        httpsAgent: agent,
      }
    );
    res.json(response.data);
  } catch (error) {
    console.error("Erro ao consultar boleto Inter:", error.response?.data || error.message);
    res.status(500).json({ error: error.response?.data || "Erro ao consultar boleto Inter." });
  }
});
router.get('/pdf-simples/:codigoSolicitacao', async (req, res) => {
  const { codigoSolicitacao } = req.params;
  console.log(`📄 Baixando PDF simples para código: ${codigoSolicitacao}`);
  try {
    // Buscar o boleto para obter o inter_conta_id
    const [[boleto]] = await pool.query(
      'SELECT inter_conta_id FROM boletos WHERE codigo_solicitacao = ? LIMIT 1',
      [codigoSolicitacao]
    );

    if (!boleto || !boleto.inter_conta_id) {
      return res.status(404).json({ error: 'Boleto não encontrado ou sem inter_conta_id configurado' });
    }

    // Buscar a conta Inter
    let [[contaInter]] = await pool.query(
      'SELECT * FROM inter_accounts WHERE id = ? AND status = "ativo"',
      [boleto.inter_conta_id]
    );

    // Se não encontrou na inter_accounts, buscar na contas_api
    if (!contaInter) {
      [[contaInter]] = await pool.query(
        `SELECT 
           id,
           inter_apelido as apelido,
           inter_conta_corrente as conta_corrente,
           inter_client_id as client_id,
           inter_client_secret as client_secret,
           inter_cert_b64 as cert_b64,
           inter_key_b64 as key_b64,
           inter_ambiente as ambiente
         FROM contas_api 
         WHERE id = ? AND inter_enabled = TRUE AND inter_status = 'ativo'`,
        [boleto.inter_conta_id]
      );
    }

    if (!contaInter) {
      return res.status(404).json({ error: 'Conta Inter não encontrada ou inativa' });
    }

    console.log(`🏦 Usando conta Inter: ${contaInter.apelido || contaInter.conta_corrente}`);

    // Gerar token usando as credenciais da conta
    const automacao = require('../../services/financeiro/automacaoRecorrencia');
    const access_token = await automacao.gerarTokenInterComCredenciais(contaInter);

    // Configurar agente HTTPS com as credenciais da conta
    const cert = Buffer.from(contaInter.cert_b64, 'base64').toString('utf-8');
    const key = Buffer.from(contaInter.key_b64, 'base64').toString('utf-8');
    const agent = new (require('https').Agent)({ cert, key });

    const contaCorrente = normalizarContaCorrente(contaInter.conta_corrente);

    // URL base baseada no ambiente
    const baseUrl = contaInter.ambiente === 'hml' 
      ? 'https://cdp.partners.bancointer.com.br' 
      : 'https://cdpj.partners.bancointer.com.br';

    // Agora buscar o PDF
    console.log(`🔍 Buscando PDF do boleto ${codigoSolicitacao}...`);
    
    const pdfResponse = await axios.get(
      `${baseUrl}/cobranca/v3/cobrancas/${codigoSolicitacao}/pdf`,
      {
        responseType: 'arraybuffer',
        headers: {
          "Authorization": `Bearer ${access_token}`,
          "x-conta-corrente": contaCorrente,
        },
        httpsAgent: agent,
      }
    );
    console.log(`📄 PDF recebido - Status: ${pdfResponse.status}, Tamanho: ${pdfResponse.data.length} bytes`);
    if (!pdfResponse.data || pdfResponse.data.length === 0) {
      return res.status(500).json({ error: "PDF não encontrado" });
    }
    // Verificar se é JSON com PDF em base64
    if (pdfResponse.headers['content-type'] === 'application/json') {
      const jsonString = pdfResponse.data.toString('utf-8');
      const json = JSON.parse(jsonString);
      
      if (json.pdf) {
        const pdfBuffer = Buffer.from(json.pdf, 'base64');
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="boleto_${codigoSolicitacao}.pdf"`);
        return res.send(pdfBuffer);
      }
    }
    // Se não é JSON, tratar como PDF binário
    const pdfBuffer = Buffer.from(pdfResponse.data);
    const pdfHeader = pdfBuffer.toString('ascii', 0, 4);
    
    if (pdfHeader === '%PDF') {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="boleto_${codigoSolicitacao}.pdf"`);
      return res.send(pdfBuffer);
    }
    return res.status(500).json({ error: "Arquivo não é um PDF válido" });
  } catch (error) {
    console.error("❌ Erro:", error.message);
    
    if (error.response) {
      return res.status(500).json({ 
        error: "Erro ao baixar PDF",
        status: error.response.status,
        message: error.response.statusText
      });
    } else {
      return res.status(500).json({ 
        error: "Erro na requisição",
        message: error.message
      });
    }
  }
});
router.get('/teste-boleto/:codigoSolicitacao', async (req, res) => {
  const { codigoSolicitacao } = req.params;
  console.log(`🔍 Testando boleto: ${codigoSolicitacao}`);
  try {
    // Importar a classe de automação para usar o sistema de token
    const AutomacaoRecorrencia = require('../../services/financeiro/automacaoRecorrencia');
    const automacao = new AutomacaoRecorrencia();
    
    // Obter token do Inter (com regeneração automática)
    const access_token = await automacao.obterTokenInter();
    console.log(`🔑 Token obtido com sucesso`);
    const cert = Buffer.from(process.env.INTER_CERT_B64, 'base64').toString('utf-8');
    const key = Buffer.from(process.env.INTER_KEY_B64, 'base64').toString('utf-8');
    const agent = new (require('https').Agent)({ cert, key });
    // Primeiro, consultar o boleto para verificar se existe
    console.log(`🔍 Consultando boleto ${codigoSolicitacao}...`);
    const boletoResponse = await axios.get(
      `https://cdpj.partners.bancointer.com.br/cobranca/v3/cobrancas/${codigoSolicitacao}`,
      {
        headers: {
          "Authorization": `Bearer ${access_token}`,
          "x-conta-corrente": "269127208",
        },
        httpsAgent: agent,
      }
    );
    console.log(`✅ Boleto encontrado!`);
    
    res.json({
      success: true,
      boleto: boletoResponse.data,
      temPDF: !!boletoResponse.data.pdf,
      status: boletoResponse.status,
      headers: boletoResponse.headers
    });
  } catch (error) {
    console.error("❌ Erro ao consultar boleto:", error.message);
    
    if (error.response) {
      console.error("❌ Status:", error.response.status);
      console.error("❌ Headers:", error.response.headers);
      
      return res.status(500).json({
        error: "Erro ao consultar boleto",
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data
      });
    } else {
      return res.status(500).json({
        error: "Erro na requisição",
        message: error.message
      });
    }
  }
});
router.post('/regenerar-token', async (req, res) => {
  try {
    console.log("🔄 Forçando regeneração do token do Inter...");
    
    // Importar a classe de automação
    const AutomacaoRecorrencia = require('../../services/financeiro/automacaoRecorrencia');
    const automacao = new AutomacaoRecorrencia();
    
    // Forçar regeneração do token
    const newToken = await automacao.gerarTokenInter();
    
    console.log("✅ Token regenerado com sucesso!");
    
    res.json({
      success: true,
      message: "Token do Inter regenerado com sucesso!",
      token: newToken.substring(0, 20) + "..." // Mostrar apenas parte do token por segurança
    });
    
  } catch (error) {
    console.error("❌ Erro ao regenerar token:", error.message);
    res.status(500).json({
      error: "Erro ao regenerar token do Inter",
      message: error.message
    });
  }
});
router.get('/teste-simples/:codigoSolicitacao', async (req, res) => {
  const { codigoSolicitacao } = req.params;
  console.log(`🔍 Testando boleto simples: ${codigoSolicitacao}`);
  try {
    // 1) Buscar o boleto para obter o inter_conta_id
    const [[boleto]] = await pool.query(
      'SELECT id, inter_conta_id FROM boletos WHERE codigo_solicitacao = ? LIMIT 1',
      [codigoSolicitacao]
    );
    
    if (!boleto) {
      return res.status(404).json({ error: "Boleto não encontrado" });
    }

    if (!boleto.inter_conta_id) {
      return res.status(400).json({ error: "Boleto não tem inter_conta_id configurado" });
    }

    // 2) Buscar informações da conta Inter
    const [[contaInter]] = await pool.query(`
      SELECT id, apelido, conta_corrente, client_id, client_secret, ambiente, cert_b64, key_b64
      FROM inter_accounts 
      WHERE id = ?
    `, [boleto.inter_conta_id]);

    if (!contaInter) {
      return res.status(400).json({ error: `Conta Inter ${boleto.inter_conta_id} não encontrada` });
    }

    // 3) Gerar token usando as credenciais da conta específica
    console.log(`🔄 Gerando token novo do Inter para conta ${contaInter.apelido}...`);
    
    const scope = "boleto-cobranca.read boleto-cobranca.write";
    const params = new URLSearchParams();
    params.append("client_id", contaInter.client_id);
    params.append("client_secret", contaInter.client_secret);
    params.append("grant_type", "client_credentials");
    params.append("scope", scope);

    const cert = Buffer.from(contaInter.cert_b64, 'base64').toString('utf-8');
    const key = Buffer.from(contaInter.key_b64, 'base64').toString('utf-8');
    const agent = new (require('https').Agent)({ cert, key });

    // URL base baseada no ambiente
    const baseUrl = contaInter.ambiente === 'hml' 
      ? 'https://cdp.partners.bancointer.com.br' 
      : 'https://cdpj.partners.bancointer.com.br';

    const tokenResponse = await axios.post(
      `${baseUrl}/oauth/v2/token`,
      params,
      {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        httpsAgent: agent,
      }
    );
    
    const access_token = tokenResponse.data.access_token;
    console.log("✅ Token novo gerado!");

    // 4) Salvar token no cache com inter_conta_id
    await pool.query(
      `INSERT INTO inter_tokens_validate_cache 
       (inter_conta_id, access_token, token_type, scope, expires_in) 
       VALUES (?, ?, ?, ?, ?)`,
      [
        contaInter.id, 
        access_token, 
        tokenResponse.data.token_type || 'Bearer', 
        scope, 
        tokenResponse.data.expires_in
      ]
    );

    // 5) Consultar o boleto
    console.log(`🔍 Consultando boleto ${codigoSolicitacao}...`);
    const boletoResponse = await axios.get(
      `${baseUrl}/cobranca/v3/cobrancas/${codigoSolicitacao}`,
      {
        headers: {
          "Authorization": `Bearer ${access_token}`,
          "x-conta-corrente": contaInter.conta_corrente,
        },
        httpsAgent: agent,
      }
    );
    console.log(`✅ Boleto encontrado!`);
    
    res.json({
      success: true,
      message: "Boleto encontrado com token novo!",
      boleto: boletoResponse.data,
      temPDF: !!boletoResponse.data.pdf,
      status: boletoResponse.status,
      conta_utilizada: {
        id: contaInter.id,
        apelido: contaInter.apelido,
        ambiente: contaInter.ambiente
      }
    });
  } catch (error) {
    console.error("❌ Erro:", error.message);
    
    if (error.response) {
      return res.status(500).json({
        error: "Erro ao consultar boleto",
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data
      });
    } else {
      return res.status(500).json({
        error: "Erro na requisição",
        message: error.message
      });
    }
  }
});
router.get('/boletos/venda/:vendaId', async (req, res) => {
  const { vendaId } = req.params;
  try {
    const [rows] = await pool.query(
      'SELECT codigo_solicitacao FROM boletos WHERE venda_id = ? LIMIT 1',
      [vendaId]
    );
    if (rows.length === 0 || !rows[0].codigo_solicitacao) {
      return res.status(404).json({ error: 'Boleto não encontrado para esse venda_id.' });
    }
    return res.json({ codigoSolicitacao: rows[0].codigo_solicitacao });
  } catch (error) {
    console.error("Erro ao buscar boleto por venda_id:", error);
    return res.status(500).json({ error: "Erro interno ao buscar boleto." });
  }
});
router.get('/boletos/por-contrato/:contratoId', async (req, res) => {
  const { contratoId } = req.params;
  try {
    const [rows] = await pool.query(
      'SELECT codigo_solicitacao FROM boletos WHERE contrato_id = ? LIMIT 1',
      [contratoId]
    );
    if (rows.length === 0 || !rows[0].codigo_solicitacao) {
      return res.status(404).json({ error: 'Boleto não encontrado para esse contrato_id.' });
    }
    return res.json({
      codigoSolicitacao: rows[0].codigo_solicitacao
    });
  } catch (error) {
    console.error("Erro ao buscar boleto por contrato_id:", error);
    return res.status(500).json({ error: "Erro interno ao buscar boleto." });
  }
});

// ✅ Buscar boleto por venda_id
router.get('/boletos/por-venda/:vendaId', async (req, res) => {
  const { vendaId } = req.params;
  try {
    console.log(`🔍 Buscando boleto para venda_id: ${vendaId}`);
    
    // Buscar com mais informações para debug
    const [rows] = await pool.query(
      `SELECT 
        id, 
        codigo_solicitacao, 
        venda_id, 
        contrato_id, 
        gerado_manualmente,
        data_vencimento,
        valor,
        status
      FROM boletos 
      WHERE venda_id = ? 
      ORDER BY criado_em DESC 
      LIMIT 1`,
      [vendaId]
    );
    
    console.log(`📊 Boletos encontrados para venda ${vendaId}:`, rows);
    
    if (rows.length === 0) {
      return res.status(404).json({ 
        error: 'Nenhum boleto encontrado para esse venda_id.',
        vendaId: vendaId,
        debug: 'Verifique se a venda tem boleto gerado'
      });
    }
    
    const boleto = rows[0];
    
    if (!boleto.codigo_solicitacao) {
      return res.status(404).json({ 
        error: 'Boleto encontrado mas sem codigo_solicitacao.',
        vendaId: vendaId,
        boletoId: boleto.id,
        debug: 'Boleto existe mas não tem código de solicitação'
      });
    }
    
    return res.json({
      codigoSolicitacao: boleto.codigo_solicitacao,
      boletoId: boleto.id,
      geradoManualmente: boleto.gerado_manualmente,
      dataVencimento: boleto.data_vencimento,
      valorNominal: boleto.valor,
      status: boleto.status
    });
  } catch (error) {
    console.error("Erro ao buscar boleto por venda_id:", error);
    return res.status(500).json({ error: "Erro interno ao buscar boleto." });
  }
});

// ✅ Listar todos os boletos de uma venda (para debug)
router.get('/boletos/todos-por-venda/:vendaId', async (req, res) => {
  const { vendaId } = req.params;
  try {
    console.log(`🔍 Listando todos os boletos para venda_id: ${vendaId}`);
    
    const [rows] = await pool.query(
      `SELECT 
        id, 
        codigo_solicitacao, 
        venda_id, 
        contrato_id, 
        gerado_manualmente,
        data_vencimento,
        valor,
        status,
        criado_em
      FROM boletos 
      WHERE venda_id = ? 
      ORDER BY criado_em DESC`,
      [vendaId]
    );
    
    console.log(`📊 Total de boletos encontrados para venda ${vendaId}: ${rows.length}`);
    
    return res.json({
      vendaId: vendaId,
      totalBoletos: rows.length,
      boletos: rows
    });
  } catch (error) {
    console.error("Erro ao listar boletos por venda_id:", error);
    return res.status(500).json({ error: "Erro interno ao listar boletos." });
  }
});

// ✅ Debug: Listar todos os boletos com informações de venda
router.get('/boletos/debug-todos', async (req, res) => {
  try {
    console.log(`🔍 Listando todos os boletos para debug`);
    
    const [rows] = await pool.query(
      `SELECT 
        id, 
        codigo_solicitacao, 
        venda_id, 
        contrato_id, 
        gerado_manualmente,
        data_vencimento,
        valor,
        status,
        numero_venda,
        criado_em
      FROM boletos 
      ORDER BY criado_em DESC
      LIMIT 20`,
      []
    );
    
    console.log(`📊 Total de boletos encontrados: ${rows.length}`);
    
    return res.json({
      totalBoletos: rows.length,
      boletos: rows
    });
  } catch (error) {
    console.error("Erro ao listar todos os boletos:", error);
    return res.status(500).json({ error: "Erro interno ao listar boletos." });
  }
});

// ✅ Buscar boleto pelo numero_venda (contém info da venda)
router.get('/boletos/por-numero-venda/:numeroVenda', async (req, res) => {
  const { numeroVenda } = req.params;
  try {
    console.log(`🔍 Buscando boleto pelo numero_venda: ${numeroVenda}`);
    
    const [rows] = await pool.query(
      `SELECT 
        id, 
        codigo_solicitacao, 
        venda_id, 
        contrato_id, 
        gerado_manualmente,
        data_vencimento,
        valor,
        status,
        numero_venda,
        criado_em
      FROM boletos 
      WHERE numero_venda LIKE ? 
      ORDER BY criado_em DESC 
      LIMIT 1`,
      [`%${numeroVenda}%`]
    );
    
    console.log(`📊 Boletos encontrados para numero_venda ${numeroVenda}:`, rows);
    
    if (rows.length === 0) {
      return res.status(404).json({ 
        error: 'Nenhum boleto encontrado para esse numero_venda.',
        seuNumero: numeroVenda,
        debug: 'Verifique se o numero_venda está correto'
      });
    }
    
    const boleto = rows[0];
    
    if (!boleto.codigo_solicitacao) {
      return res.status(404).json({ 
        error: 'Boleto encontrado mas sem codigo_solicitacao.',
        seuNumero: numeroVenda,
        boletoId: boleto.id,
        debug: 'Boleto existe mas não tem código de solicitação'
      });
    }
    
    return res.json({
      codigoSolicitacao: boleto.codigo_solicitacao,
      boletoId: boleto.id,
      vendaId: boleto.venda_id,
      contratoId: boleto.contrato_id,
      geradoManualmente: boleto.gerado_manualmente,
      dataVencimento: boleto.data_vencimento,
      valorNominal: boleto.valor,
      status: boleto.status,
      seuNumero: boleto.numero_venda
    });
  } catch (error) {
    console.error("Erro ao buscar boleto por numero_venda:", error);
    return res.status(500).json({ error: "Erro interno ao buscar boleto." });
  }
});

// ✅ Corrigir venda_id NULL baseado no numero_venda
router.patch('/boletos/corrigir-venda-id/:boletoId', async (req, res) => {
  const { boletoId } = req.params;
  try {
    console.log(`🔧 Corrigindo venda_id para boleto: ${boletoId}`);
    
    // Buscar o boleto atual
    const [boletoRows] = await pool.query(
      'SELECT id, numero_venda, venda_id FROM boletos WHERE id = ?',
      [boletoId]
    );
    
    if (boletoRows.length === 0) {
      return res.status(404).json({ error: 'Boleto não encontrado' });
    }
    
    const boleto = boletoRows[0];
    console.log(`📊 Boleto atual:`, boleto);
    
    // Extrair venda_id do numero_venda (formato: VENDA_XXX_XXXXX)
    const vendaMatch = boleto.numero_venda?.match(/VENDA_(\d+)_/);
    if (!vendaMatch) {
      return res.status(400).json({ 
        error: 'Não foi possível extrair venda_id do numero_venda',
        seuNumero: boleto.numero_venda
      });
    }
    
    const vendaId = parseInt(vendaMatch[1]);
    console.log(`🎯 Venda ID extraída: ${vendaId}`);
    
    // Atualizar o boleto
    const [result] = await pool.query(
      'UPDATE boletos SET venda_id = ? WHERE id = ?',
      [vendaId, boletoId]
    );
    
    if (result.affectedRows === 0) {
      return res.status(500).json({ error: 'Erro ao atualizar boleto' });
    }
    
    // Buscar o boleto atualizado
    const [updatedRows] = await pool.query(
      'SELECT id, venda_id, numero_venda, codigo_solicitacao FROM boletos WHERE id = ?',
      [boletoId]
    );
    
    return res.json({
      message: 'Venda ID corrigida com sucesso!',
      boleto: updatedRows[0]
    });
    
  } catch (error) {
    console.error("Erro ao corrigir venda_id:", error);
    return res.status(500).json({ error: "Erro interno ao corrigir venda_id." });
  }
});

// ✅ Correção rápida: Corrigir todos os boletos com venda_id NULL
router.post('/boletos/corrigir-todos-venda-id', async (req, res) => {
  try {
    console.log(`🔧 Corrigindo todos os boletos com venda_id NULL`);
    
    // Buscar todos os boletos com venda_id NULL mas com numero_venda de venda
    const [boletosParaCorrigir] = await pool.query(
      `SELECT id, numero_venda, venda_id 
       FROM boletos 
       WHERE venda_id IS NULL 
         AND numero_venda LIKE 'VENDA_%_%'`
    );
    
    console.log(`📊 Boletos encontrados para corrigir:`, boletosParaCorrigir);
    
    let corrigidos = 0;
    const resultados = [];
    
    for (const boleto of boletosParaCorrigir) {
      // Extrair venda_id do numero_venda (formato: VENDA_XXX_XXXXX)
      const vendaMatch = boleto.numero_venda?.match(/VENDA_(\d+)_/);
      if (vendaMatch) {
        const vendaId = parseInt(vendaMatch[1]);
        
        // Atualizar o boleto
        const [result] = await pool.query(
          'UPDATE boletos SET venda_id = ? WHERE id = ?',
          [vendaId, boleto.id]
        );
        
        if (result.affectedRows > 0) {
          corrigidos++;
          resultados.push({
            boletoId: boleto.id,
            vendaId: vendaId,
            seuNumero: boleto.numero_venda,
            status: 'corrigido'
          });
        }
      }
    }
    
    return res.json({
      message: `${corrigidos} boletos corrigidos com sucesso!`,
      totalEncontrados: boletosParaCorrigir.length,
      totalCorrigidos: corrigidos,
      resultados: resultados
    });
    
  } catch (error) {
    console.error("Erro ao corrigir venda_id em massa:", error);
    return res.status(500).json({ error: "Erro interno ao corrigir venda_id." });
  }
});

// ✅ Buscar boleto pelo codigo_solicitacao (alternativa direta)
router.get('/boletos/por-codigo/:codigoSolicitacao', async (req, res) => {
  const { codigoSolicitacao } = req.params;
  try {
    console.log(`🔍 Buscando boleto pelo codigo_solicitacao: ${codigoSolicitacao}`);
    
    const [rows] = await pool.query(
      `SELECT 
        id, 
        codigo_solicitacao, 
        venda_id, 
        contrato_id, 
        gerado_manualmente,
        data_vencimento,
        valor,
        status,
        numero_venda,
        criado_em
      FROM boletos 
      WHERE codigo_solicitacao = ? 
      LIMIT 1`,
      [codigoSolicitacao]
    );
    
    console.log(`📊 Boleto encontrado:`, rows);
    
    if (rows.length === 0) {
      return res.status(404).json({ 
        error: 'Boleto não encontrado para esse codigo_solicitacao.',
        codigoSolicitacao: codigoSolicitacao
      });
    }
    
    const boleto = rows[0];
    
    return res.json({
      codigoSolicitacao: boleto.codigo_solicitacao,
      boletoId: boleto.id,
      vendaId: boleto.venda_id,
      contratoId: boleto.contrato_id,
      geradoManualmente: boleto.gerado_manualmente,
      dataVencimento: boleto.data_vencimento,
      valorNominal: boleto.valor,
      status: boleto.status,
      seuNumero: boleto.numero_venda
    });
  } catch (error) {
    console.error("Erro ao buscar boleto por codigo_solicitacao:", error);
    return res.status(500).json({ error: "Erro interno ao buscar boleto." });
  }
});

// ✅ ROTA SIMPLES: Pegar codigo_solicitacao por venda_id (funciona sempre)
router.get('/boletos/codigo-por-venda/:vendaId', async (req, res) => {
  const { vendaId } = req.params;
  try {
    console.log(`🔍 Buscando codigo_solicitacao para venda: ${vendaId}`);
    
    // Busca por venda_id OU pelo numero_venda (backup)
    const [rows] = await pool.query(
      `SELECT codigo_solicitacao, id, numero_venda, venda_id
       FROM boletos 
       WHERE venda_id = ? 
          OR numero_venda LIKE ?
       ORDER BY criado_em DESC 
       LIMIT 1`,
      [vendaId, `VENDA_${vendaId}_%`]
    );
    
    console.log(`📊 Resultado da busca:`, rows);
    
    if (rows.length === 0) {
      return res.status(404).json({ 
        error: 'Nenhum boleto encontrado para essa venda.',
        vendaId: vendaId
      });
    }
    
    const boleto = rows[0];
    
    if (!boleto.codigo_solicitacao) {
      return res.status(404).json({ 
        error: 'Boleto encontrado mas sem codigo_solicitacao.',
        vendaId: vendaId,
        boletoId: boleto.id
      });
    }
    
    // Buscar dados da venda para fallback
    const [vendas] = await pool.query(`
      SELECT vencimento, situacao, valor_venda
      FROM vendas 
      WHERE id = ?
    `, [vendaId]);
    
    const venda = vendas.length > 0 ? vendas[0] : null;
    
    return res.json({
      codigo_solicitacao: boleto.codigo_solicitacao,
      codigoSolicitacao: boleto.codigo_solicitacao, // Para compatibilidade
      vendaId: vendaId,
      boletoId: boleto.id,
      valor: boleto.valor || venda?.valor_venda,
      data_vencimento: boleto.data_vencimento || venda?.vencimento,
      status: boleto.status || venda?.situacao
    });
    
  } catch (error) {
    console.error("Erro ao buscar codigo_solicitacao por venda:", error);
    return res.status(500).json({ error: "Erro interno." });
  }
});

// Sincroniza UM boleto pelo codigo_solicitacao e retorna a situação consolidada
router.post('/boletos/sincronizar-status/:codigoSolicitacao', async (req, res) => {
  try {
    const { codigoSolicitacao } = req.params;
    const r = await sincronizarUmBoletoPorCodigo(codigoSolicitacao);
    return res.json({
      ok: true,
      codigoSolicitacao,
      situacao: r.situacao,     // PAGO | CANCELADO | EM_ABERTO
      statusBruto: r.statusBruto
    });
  } catch (error) {
    console.error('Erro ao sincronizar boleto:', error);
    return res.status(500).json({ ok: false, error: error.message });
  }
});
// Sincroniza TODOS os boletos ainda não finalizados (abertos)
router.post('/boletos/sincronizar-status', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT codigo_solicitacao
        FROM boletos
       WHERE codigo_solicitacao IS NOT NULL
         AND (status IS NULL OR UPPER(status) NOT IN ('PAGO','RECEBIDO','LIQUIDADO','CANCELADO','BAIXADO','EXPIRADO'))
    `);
    const resultados = [];
    for (const r of rows) {
      try {
        const s = await sincronizarUmBoletoPorCodigo(r.codigo_solicitacao);
        resultados.push({ codigoSolicitacao: r.codigo_solicitacao, ...s });
      } catch (e) {
        resultados.push({ codigoSolicitacao: r.codigo_solicitacao, error: e.message });
      }
    }
    return res.json({ ok: true, total: resultados.length, resultados });
  } catch (error) {
    console.error('Erro ao sincronizar boletos:', error);
    return res.status(500).json({ ok: false, error: error.message });
  }
});
// Consulta apenas no seu banco a situação consolidada (sem chamar o Inter)
router.get('/boletos/status/:codigoSolicitacao', async (req, res) => {
  try {
    const { codigoSolicitacao } = req.params;
    const [[row]] = await pool.query(
      `SELECT id, codigo_solicitacao, status, data_pagamento, data_cancelamento, valor_recebido, motivo_cancelamento
         FROM boletos
        WHERE codigo_solicitacao = ?
        LIMIT 1`,
      [codigoSolicitacao]
    );
    if (!row) return res.status(404).json({ error: 'Boleto não encontrado' });
    const bruto = (row.status || '').toUpperCase();
    let situacao = 'EM_ABERTO';
    if (['PAGO','RECEBIDO','LIQUIDADO'].includes(bruto)) situacao = 'PAGO';
    if (['CANCELADO','BAIXADO','EXPIRADO'].includes(bruto)) situacao = 'CANCELADO';
    return res.json({
      codigoSolicitacao: row.codigo_solicitacao,
      situacao,
      statusBruto: bruto,
      dataPagamento: row.data_pagamento,
      dataCancelamento: row.data_cancelamento,
      valorRecebido: row.valor_recebido,
      motivoCancelamento: row.motivo_cancelamento
    });
  } catch (error) {
    console.error('Erro ao consultar situação local do boleto:', error);
    return res.status(500).json({ error: error.message });
  }
});
// 🔄 Rota para testar e regenerar token do Inter
router.post('/teste-token', async (req, res) => {
  try {
    console.log("🔄 Testando e regenerando token do Inter...");
    
    // Importar a instância de automação
    const automacao = require('../../services/financeiro/automacaoRecorrencia');
    
    // Forçar regeneração do token
    const newToken = await automacao.gerarTokenInter();
    
    // Testar o token fazendo uma requisição simples
    const agent = getHttpsAgent();
    const contaCorrente = normalizarContaCorrente(process.env.INTER_CONTA_CORRENTE || '269127208');
    
    try {
      // Fazer uma requisição de teste (consultar boletos - endpoint que sempre existe)
      const testResponse = await axios.get(
        'https://cdpj.partners.bancointer.com.br/cobranca/v3/cobrancas',
        {
          headers: {
            Authorization: `Bearer ${newToken}`,
            'x-conta-corrente': contaCorrente
          },
          httpsAgent: agent,
          params: { page: 1, size: 1 } // Limitar resultado para teste
        }
      );
      
      return res.json({
        ok: true,
        message: "Token regenerado e testado com sucesso!",
        token: newToken.substring(0, 20) + "...", // Mostrar apenas início do token
        testStatus: testResponse.status,
        contaCorrente
      });
    } catch (testError) {
      return res.json({
        ok: false,
        message: "Token regenerado mas falhou no teste",
        error: testError.response?.data || testError.message,
        token: newToken.substring(0, 20) + "...",
        contaCorrente
      });
    }
  } catch (error) {
    console.error("❌ Erro ao testar/regenerar token:", error);
    return res.status(500).json({
      ok: false,
      error: error.message
    });
  }
});

// 🤖 Rotas para controle da automação de sincronização
const cronBoletos = require('../../services/financeiro/cronBoletos');

// 🔄 Iniciar cron jobs de sincronização
router.post('/cron/iniciar', async (req, res) => {
  try {
    cronBoletos.iniciarCronJobs();
    res.json({
      success: true,
      message: "Cron jobs de sincronização iniciados com sucesso!"
    });
  } catch (error) {
    console.error("❌ Erro ao iniciar cron jobs:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 🛑 Parar cron jobs de sincronização
router.post('/cron/parar', async (req, res) => {
  try {
    cronBoletos.pararCronJobs();
    res.json({
      success: true,
      message: "Cron jobs de sincronização parados com sucesso!"
    });
  } catch (error) {
    console.error("❌ Erro ao parar cron jobs:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 📊 Obter estatísticas da sincronização
router.get('/cron/stats', async (req, res) => {
  try {
    const stats = cronBoletos.getStats();
    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error("❌ Erro ao obter estatísticas:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 🚀 Executar sincronização manual
router.post('/cron/executar', async (req, res) => {
  try {
    console.log("🚀 Executando sincronização manual...");

    // Executar em background para não bloquear a resposta
    cronBoletos.executarSincronizacao().catch(error => {
      console.error("❌ Erro na sincronização manual:", error);
    });

    res.json({
      success: true,
      message: "Sincronização manual iniciada em background!"
    });
  } catch (error) {
    console.error("❌ Erro ao iniciar sincronização manual:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 🔍 Teste: Verificar boletos pendentes
router.get('/cron/boletos-pendentes', async (req, res) => {
  try {
    const [boletos] = await pool.query(`
      SELECT id, codigo_solicitacao, status, criado_em, valor
        FROM boletos
       WHERE codigo_solicitacao IS NOT NULL
         AND (status IS NULL OR UPPER(status) NOT IN ('PAGO','RECEBIDO','LIQUIDADO','CANCELADO','BAIXADO','EXPIRADO'))
       ORDER BY criado_em DESC
    `);

    res.json({
      success: true,
      total: boletos.length,
      boletos: boletos
    });
  } catch (error) {
    console.error("❌ Erro ao buscar boletos pendentes:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 🔧 ROTA TEMPORÁRIA: Atualizar boletos existentes com inter_conta_id
router.post('/fix-existing-boletos', async (req, res) => {
  try {
    console.log("🔧 Iniciando correção de boletos existentes...");
    
    // 1. Verificar se a coluna existe
    const [[colunaExiste]] = await pool.query(`
      SELECT COUNT(*) as existe 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'boletos' 
      AND COLUMN_NAME = 'inter_conta_id'
    `);
    
    if (colunaExiste.existe === 0) {
      // Adicionar a coluna se não existir
      await pool.query(`
        ALTER TABLE boletos 
        ADD COLUMN inter_conta_id INT NULL AFTER venda_id
      `);
      console.log("✅ Coluna inter_conta_id adicionada");
    }
    
    // 2. Verificar contas Inter disponíveis
    const [contasInter] = await pool.query(`
      SELECT id, nome, ambiente, inter_client_id 
      FROM inter_accounts 
      ORDER BY id
    `);
    
    if (contasInter.length === 0) {
      return res.status(400).json({
        error: "Nenhuma conta Inter configurada encontrada",
        solucao: "Configure uma conta na tabela inter_accounts primeiro"
      });
    }
    
    // 3. Contar boletos sem inter_conta_id
    const [[boletosSemInter]] = await pool.query(`
      SELECT COUNT(*) as total 
      FROM boletos 
      WHERE inter_conta_id IS NULL 
      AND codigo_solicitacao IS NOT NULL
    `);
    
    if (boletosSemInter.total === 0) {
      return res.json({
        message: "Todos os boletos já têm inter_conta_id configurado",
        total: 0
      });
    }
    
    // 4. Usar a primeira conta Inter disponível (preferir produção)
    const contaInter = contasInter.find(c => c.ambiente === 'prod') || contasInter[0];
    
    // 5. Atualizar boletos
    const [resultado] = await pool.query(`
      UPDATE boletos 
      SET inter_conta_id = ? 
      WHERE inter_conta_id IS NULL 
      AND codigo_solicitacao IS NOT NULL
    `, [contaInter.id]);
    
    console.log(`✅ ${resultado.affectedRows} boletos atualizados com inter_conta_id = ${contaInter.id}`);
    
    res.json({
      success: true,
      message: `Boletos atualizados com sucesso`,
      total_atualizados: resultado.affectedRows,
      conta_utilizada: {
        id: contaInter.id,
        nome: contaInter.nome,
        ambiente: contaInter.ambiente
      }
    });
    
  } catch (error) {
    console.error("❌ Erro ao corrigir boletos:", error);
    res.status(500).json({
      error: error.message
    });
  }
});

// 🔧 ROTA TEMPORÁRIA: Corrigir boleto específico
router.post('/fix-boleto/:codigoSolicitacao', async (req, res) => {
  try {
    const { codigoSolicitacao } = req.params;
    console.log(`🔧 Corrigindo boleto: ${codigoSolicitacao}`);
    
    // 1. Verificar se o boleto existe
    const [[boleto]] = await pool.query(`
      SELECT id, codigo_solicitacao, inter_conta_id
      FROM boletos 
      WHERE codigo_solicitacao = ?
    `, [codigoSolicitacao]);
    
    if (!boleto) {
      return res.status(404).json({
        error: "Boleto não encontrado"
      });
    }
    
    // 2. Verificar contas Inter disponíveis
    const [contasInter] = await pool.query(`
      SELECT id, nome, ambiente, empresa_id, apelido
      FROM inter_accounts 
      ORDER BY id
    `);
    
    if (contasInter.length === 0) {
      return res.status(400).json({
        error: "Nenhuma conta Inter configurada encontrada"
      });
    }
    
    // 3. Usar a primeira conta Inter (id = 1)
    const contaInter = contasInter[0];
    
    // 4. Atualizar o boleto
    const [resultado] = await pool.query(`
      UPDATE boletos 
      SET inter_conta_id = ? 
      WHERE codigo_solicitacao = ?
    `, [contaInter.id, codigoSolicitacao]);
    
    console.log(`✅ Boleto ${codigoSolicitacao} atualizado com inter_conta_id = ${contaInter.id}`);
    
    res.json({
      success: true,
      message: "Boleto corrigido com sucesso",
      boleto: {
        id: boleto.id,
        codigo_solicitacao: boleto.codigo_solicitacao,
        inter_conta_id_anterior: boleto.inter_conta_id,
        inter_conta_id_novo: contaInter.id
      },
      conta_utilizada: {
        id: contaInter.id,
        nome: contaInter.nome,
        ambiente: contaInter.ambiente,
        apelido: contaInter.apelido
      }
    });
    
  } catch (error) {
    console.error("❌ Erro ao corrigir boleto:", error);
    res.status(500).json({
      error: error.message
    });
  }
});

// 🔧 ROTA TEMPORÁRIA: Corrigir boleto com credenciais inválidas
router.post('/fix-boleto-credenciais/:codigoSolicitacao', async (req, res) => {
  try {
    const { codigoSolicitacao } = req.params;
    console.log(`🔧 Corrigindo boleto com credenciais inválidas: ${codigoSolicitacao}`);
    
    // 1. Verificar se o boleto existe
    const [[boleto]] = await pool.query(`
      SELECT b.id, b.codigo_solicitacao, b.inter_conta_id, 
             ia.apelido, ia.client_id, ia.ambiente
      FROM boletos b
      LEFT JOIN inter_accounts ia ON b.inter_conta_id = ia.id
      WHERE b.codigo_solicitacao = ?
    `, [codigoSolicitacao]);
    
    if (!boleto) {
      return res.status(404).json({
        error: "Boleto não encontrado"
      });
    }
    
    // 2. Verificar se as credenciais são válidas
    const credenciaisValidas = boleto.client_id && 
                              !boleto.client_id.includes('aqui') && 
                              !boleto.client_id.includes('placeholder') &&
                              boleto.client_id.length > 10;
    
    if (credenciaisValidas) {
      return res.json({
        success: true,
        message: "Boleto já tem credenciais válidas",
        boleto: {
          id: boleto.id,
          codigo_solicitacao: boleto.codigo_solicitacao,
          inter_conta_id: boleto.inter_conta_id,
          apelido: boleto.apelido,
          ambiente: boleto.ambiente
        }
      });
    }
    
    // 3. Buscar conta Inter com credenciais válidas
    const [contasValidas] = await pool.query(`
      SELECT id, apelido, ambiente, client_id, is_default
      FROM inter_accounts 
      WHERE client_id NOT LIKE '%aqui%' 
        AND client_id NOT LIKE '%placeholder%'
        AND client_id IS NOT NULL
        AND client_id != ''
        AND LENGTH(client_id) > 10
      ORDER BY is_default DESC, id
      LIMIT 1
    `);
    
    if (contasValidas.length === 0) {
      return res.status(400).json({
        error: "Nenhuma conta Inter com credenciais válidas encontrada",
        solucao: "Configure uma conta com credenciais reais na tabela inter_accounts"
      });
    }
    
    const contaValida = contasValidas[0];
    
    // 4. Atualizar o boleto
    const [resultado] = await pool.query(`
      UPDATE boletos 
      SET inter_conta_id = ? 
      WHERE codigo_solicitacao = ?
    `, [contaValida.id, codigoSolicitacao]);
    
    console.log(`✅ Boleto ${codigoSolicitacao} atualizado para usar conta ${contaValida.apelido} (id: ${contaValida.id})`);
    
    res.json({
      success: true,
      message: "Boleto corrigido com credenciais válidas",
      boleto: {
        id: boleto.id,
        codigo_solicitacao: boleto.codigo_solicitacao,
        inter_conta_id_anterior: boleto.inter_conta_id,
        inter_conta_id_novo: contaValida.id
      },
      conta_utilizada: {
        id: contaValida.id,
        apelido: contaValida.apelido,
        ambiente: contaValida.ambiente,
        is_default: contaValida.is_default
      }
    });
    
  } catch (error) {
    console.error("❌ Erro ao corrigir boleto:", error);
    res.status(500).json({
      error: error.message
    });
  }
});

// 🔧 ROTA TEMPORÁRIA: Testar sincronização de boleto específico
router.post('/test-sync/:codigoSolicitacao', async (req, res) => {
  try {
    const { codigoSolicitacao } = req.params;
    console.log(`🔧 Testando sincronização do boleto: ${codigoSolicitacao}`);
    
    // Importar o cronBoletos
    const cronBoletos = require('../../services/financeiro/cronBoletos');
    
    // Executar sincronização do boleto específico
    const resultado = await cronBoletos.sincronizarBoleto(codigoSolicitacao);
    
    console.log(`📊 Resultado da sincronização:`, resultado);
    
    res.json({
      success: true,
      resultado: resultado,
      message: resultado.success ? "Sincronização executada com sucesso" : "Erro na sincronização"
    });
    
  } catch (error) {
    console.error("❌ Erro ao testar sincronização:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 💰 ROTA TEMPORÁRIA: Testar criação de transação de contas a receber
router.post('/test-criar-transacao/:codigoSolicitacao', async (req, res) => {
  try {
    const { codigoSolicitacao } = req.params;
    console.log(`💰 Testando criação de transação para boleto: ${codigoSolicitacao}`);
    
    // Importar o cronBoletos
    const cronBoletos = require('../../services/financeiro/cronBoletos');
    
    // 1) Buscar o boleto
    const [[boleto]] = await pool.query(`
      SELECT id, status, valor, numero_venda, codigo_solicitacao
      FROM boletos 
      WHERE codigo_solicitacao = ?
    `, [codigoSolicitacao]);
    
    if (!boleto) {
      return res.status(404).json({
        error: "Boleto não encontrado"
      });
    }

    // 2) Simular campos de pagamento
    const campos = {
      statusBruto: 'PAGO',
      valorRecebido: boleto.valor,
      dataPagamento: new Date(),
      statusConsolidado: 'PAGO'
    };

    // 3) Criar transação
    const transacaoId = await cronBoletos.criarTransacaoContasReceber(boleto.id, campos);
    
    res.json({
      success: true,
      message: "Transação de contas a receber criada com sucesso",
      boleto: {
        id: boleto.id,
        codigo_solicitacao: boleto.codigo_solicitacao,
        numero_venda: boleto.numero_venda,
        valor: boleto.valor
      },
      transacao: {
        id: transacaoId,
        tipo: 'RECEITA',
        valor: campos.valorRecebido,
        data_pagamento: campos.dataPagamento
      }
    });
    
  } catch (error) {
    console.error("❌ Erro ao testar criação de transação:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 💪 ROTA TEMPORÁRIA: Forçar criação de transação (ignora verificação de duplicata)
router.post('/forcar-criar-transacao/:codigoSolicitacao', async (req, res) => {
  try {
    const { codigoSolicitacao } = req.params;
    console.log(`💪 Forçando criação de transação para boleto: ${codigoSolicitacao}`);
    
    // Importar o cronBoletos
    const cronBoletos = require('../../services/financeiro/cronBoletos');
    
    // 1) Buscar o boleto
    const [[boleto]] = await pool.query(`
      SELECT id, status, valor, numero_venda, codigo_solicitacao
      FROM boletos 
      WHERE codigo_solicitacao = ?
    `, [codigoSolicitacao]);
    
    if (!boleto) {
      return res.status(404).json({
        error: "Boleto não encontrado"
      });
    }

    // 2) Simular campos de pagamento
    const campos = {
      statusBruto: 'PAGO',
      valorRecebido: boleto.valor,
      dataPagamento: new Date(),
      statusConsolidado: 'PAGO'
    };

    // 3) Criar transação forçada (ignora verificação de duplicata)
    const transacaoId = await cronBoletos.criarTransacaoContasReceberForcado(boleto.id, campos);
    
    res.json({
      success: true,
      message: "Transação de contas a receber criada com sucesso (forçada)",
      boleto: {
        id: boleto.id,
        codigo_solicitacao: boleto.codigo_solicitacao,
        numero_venda: boleto.numero_venda,
        valor: boleto.valor
      },
      transacao: {
        id: transacaoId,
        tipo: 'RECEITA',
        valor: campos.valorRecebido,
        data_pagamento: campos.dataPagamento
      }
    });
    
  } catch (error) {
    console.error("❌ Erro ao forçar criação de transação:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 🛒 ROTA TEMPORÁRIA: Testar criação de venda
router.post('/test-criar-venda/:codigoSolicitacao', async (req, res) => {
  try {
    const { codigoSolicitacao } = req.params;
    const { categoria_id, sub_categoria_id } = req.body;
    console.log(`🛒 Testando criação de venda para boleto: ${codigoSolicitacao}`);
    console.log(`📋 Parâmetros recebidos: categoria_id=${categoria_id}, sub_categoria_id=${sub_categoria_id}`);
    
    // Importar o cronBoletos
    const cronBoletos = require('../../services/financeiro/cronBoletos');
    
    // 1) Buscar o boleto
    const [[boleto]] = await pool.query(`
      SELECT id, status, valor, numero_venda, codigo_solicitacao
      FROM boletos 
      WHERE codigo_solicitacao = ?
    `, [codigoSolicitacao]);
    
    if (!boleto) {
      return res.status(404).json({
        error: "Boleto não encontrado"
      });
    }

    // 2) Criar venda com parâmetros personalizados (origem: manual)
    const vendaId = await cronBoletos.criarVendaParaBoleto(boleto.id, { categoria_id, sub_categoria_id }, false);
    
    res.json({
      success: true,
      message: "Venda criada com sucesso",
      boleto: {
        id: boleto.id,
        codigo_solicitacao: boleto.codigo_solicitacao,
        numero_venda: boleto.numero_venda,
        valor: boleto.valor
      },
      venda: {
        id: vendaId,
        tipo_venda: 'orcamento',
        situacao: 'aprovado',
        categoria_id: categoria_id || 'padrão',
        sub_categoria_id: sub_categoria_id || 'não informado'
      },
      parametros_usados: {
        categoria_id,
        sub_categoria_id
      }
    });
    
  } catch (error) {
    console.error("❌ Erro ao testar criação de venda:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 🆕 NOVA ROTA: Atualizar venda para "recebido" quando boleto for pago
router.post('/atualizar-venda-recebido/:codigoSolicitacao', async (req, res) => {
  try {
    const { codigoSolicitacao } = req.params;
    console.log(`🔄 Atualizando venda para boleto RECEBIDO: ${codigoSolicitacao}`);

    // 1) Buscar o boleto
    const [[boleto]] = await pool.query(`
      SELECT id, status, valor, valor_recebido, data_pagamento, venda_id
      FROM boletos
      WHERE codigo_solicitacao = ?
    `, [codigoSolicitacao]);

    if (!boleto) {
      return res.status(404).json({ error: "Boleto não encontrado" });
    }

    console.log(`📊 Boleto encontrado: ID=${boleto.id}, Status=${boleto.status}, Venda_ID=${boleto.venda_id}`);

    // 2) Verificar se o boleto está como RECEBIDO/PAGO
    if (!['RECEBIDO', 'PAGO', 'LIQUIDADO'].includes(boleto.status)) {
      return res.status(400).json({ 
        error: `Boleto não está pago. Status atual: ${boleto.status}` 
      });
    }

    // 3) Verificar se tem venda associada
    if (!boleto.venda_id) {
      return res.status(400).json({ 
        error: "Boleto não possui venda associada" 
      });
    }

    // 4) Simular campos de boleto pago
    const campos = {
      statusBruto: boleto.status,
      statusConsolidado: 'PAGO',
      valorRecebido: boleto.valor_recebido || boleto.valor,
      dataPagamento: boleto.data_pagamento || new Date(),
      dataCancelamento: null,
      motivoCancelamento: null
    };

    // 5) Atualizar a venda usando a função do cronBoletos
    const cronBoletos = require('../../services/financeiro/cronBoletos');
    await cronBoletos.atualizarStatusVendaParaRecebido(boleto.venda_id, campos);

    console.log(`✅ Venda ${boleto.venda_id} atualizada para "recebido" com sucesso!`);

    res.json({
      success: true,
      message: `Venda ${boleto.venda_id} atualizada para "recebido"`,
      boleto: {
        id: boleto.id,
        codigo_solicitacao: codigoSolicitacao,
        status: boleto.status,
        venda_id: boleto.venda_id,
        valor_recebido: campos.valorRecebido,
        data_pagamento: campos.dataPagamento
      }
    });

  } catch (error) {
    console.error("❌ Erro ao atualizar venda para recebido:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 🧪 ROTA TEMPORÁRIA: Testar criação para boleto já pago
router.post('/test-criar-para-pago/:codigoSolicitacao', async (req, res) => {
  try {
    const { codigoSolicitacao } = req.params;
    console.log(`🧪 Testando criação para boleto já pago: ${codigoSolicitacao}`);

    const cronBoletos = require('../../services/financeiro/cronBoletos');

    const [[boleto]] = await pool.query(`
      SELECT id, status, valor, numero_venda, codigo_solicitacao, pagador_cpf_cnpj, empresa_id
      FROM boletos
      WHERE codigo_solicitacao = ?
    `, [codigoSolicitacao]);

    if (!boleto) {
      return res.status(404).json({ error: "Boleto não encontrado" });
    }

    console.log(`📊 Boleto encontrado: ID=${boleto.id}, Status=${boleto.status}`);

    // Verificar se já tem transação
    const [transacoes] = await pool.query(`
      SELECT id FROM transacoes WHERE boleto_id = ?
    `, [boleto.id]);

    console.log(`🔍 Transações existentes: ${transacoes.length}`);

    // Verificar se já tem venda
    const [vendas] = await pool.query(`
      SELECT id FROM vendas WHERE boleto_id = ?
    `, [boleto.id]);

    console.log(`🔍 Vendas existentes: ${vendas.length}`);

    // Simular campos de boleto pago
    const campos = {
      statusBruto: 'RECEBIDO',
      statusConsolidado: 'PAGO',
      valorRecebido: boleto.valor,
      dataPagamento: new Date(),
      dataCancelamento: null,
      motivoCancelamento: null
    };

    // Criar transação se não existir
    let transacaoId = null;
    if (transacoes.length === 0) {
      console.log(`💰 Criando transação...`);
      transacaoId = await cronBoletos.criarTransacaoContasReceber(boleto.id, campos);
    } else {
      console.log(`⚠️ Transação já existe: ${transacoes[0].id}`);
      transacaoId = transacoes[0].id;
    }

    // Criar venda se não existir
    let vendaId = null;
    let vendaInfo = null;
    if (vendas.length === 0) {
      console.log(`🛒 Criando venda...`);
      vendaId = await cronBoletos.criarVendaAutomatica(boleto, campos, null, true);
      
      // Buscar informações da venda criada
      if (vendaId) {
        const [[vendaCriada]] = await pool.query(`
          SELECT id, categoria_id, sub_categoria_id, valor_venda, criado_em 
          FROM vendas WHERE id = ?
        `, [vendaId]);
        vendaInfo = vendaCriada;
      }
    } else {
      console.log(`⚠️ Venda já existe: ${vendas[0].id}`);
      vendaId = vendas[0].id;
      vendaInfo = vendas[0];
    }

    res.json({ 
      success: true, 
      message: "Teste concluído",
      boleto: {
        id: boleto.id,
        status: boleto.status,
        pagador_cpf_cnpj: boleto.pagador_cpf_cnpj,
        empresa_id: boleto.empresa_id,
        transacoes_existentes: transacoes.length,
        vendas_existentes: vendas.length
      },
      transacao: {
        id: transacaoId,
        criada: transacoes.length === 0
      },
      venda: {
        id: vendaId,
        criada: vendas.length === 0,
        categoria_id: vendaInfo?.categoria_id,
        sub_categoria_id: vendaInfo?.sub_categoria_id,
        valor_venda: vendaInfo?.valor_venda
      }
    });
  } catch (error) {
    console.error(`❌ Erro no teste:`, error.message);
    console.error(`❌ Stack trace:`, error.stack);
    res.status(500).json({ error: error.message });
  }
});

// 🧪 ROTA TEMPORÁRIA: Testar sincronização com nova lógica
router.post('/test-sync-nova-logica/:codigoSolicitacao', async (req, res) => {
  try {
    const { codigoSolicitacao } = req.params;
    console.log(`🧪 Testando sincronização com nova lógica: ${codigoSolicitacao}`);

    const cronBoletos = require('../../services/financeiro/cronBoletos');

    // Executar sincronização do boleto específico
    const resultado = await cronBoletos.sincronizarBoleto(codigoSolicitacao);
    
    console.log(`📊 Resultado da sincronização:`, resultado);

    res.json({
      success: true,
      resultado: resultado,
      message: resultado.success ? "Sincronização executada com sucesso" : "Erro na sincronização"
    });
  } catch (error) {
    console.error(`❌ Erro no teste:`, error.message);
    res.status(500).json({ error: error.message });
  }
});

// 🧪 ROTA TEMPORÁRIA: Verificar status de transações e vendas
router.get('/verificar-status/:codigoSolicitacao', async (req, res) => {
  try {
    const { codigoSolicitacao } = req.params;
    console.log(`🔍 Verificando status para: ${codigoSolicitacao}`);

    // Buscar boleto
    const [[boleto]] = await pool.query(`
      SELECT id, status, valor, numero_venda, codigo_solicitacao, pagador_cpf_cnpj, empresa_id, contrato_id
      FROM boletos
      WHERE codigo_solicitacao = ?
    `, [codigoSolicitacao]);

    if (!boleto) {
      return res.status(404).json({ error: "Boleto não encontrado" });
    }

    // Verificar transações
    const [transacoes] = await pool.query(`
      SELECT id, descricao, valor, criado_em FROM transacoes WHERE boleto_id = ?
    `, [boleto.id]);

    // Verificar vendas
    const [vendas] = await pool.query(`
      SELECT id, tipo_venda, situacao, valor_venda, categoria_id, sub_categoria_id, criado_em FROM vendas WHERE boleto_id = ?
    `, [boleto.id]);

    // Verificar contrato (se houver)
    let contrato = null;
    if (boleto.contrato_id) {
      const [[contratoData]] = await pool.query(`
        SELECT id, categoria_id, sub_categoria_id, valor, numero_contrato, cliente_id
        FROM contratos WHERE id = ?
      `, [boleto.contrato_id]);
      contrato = contratoData;
    }

    res.json({
      success: true,
      boleto: {
        id: boleto.id,
        codigo_solicitacao: boleto.codigo_solicitacao,
        status: boleto.status,
        valor: boleto.valor,
        contrato_id: boleto.contrato_id
      },
      contrato: contrato,
      transacoes: {
        total: transacoes.length,
        items: transacoes
      },
      vendas: {
        total: vendas.length,
        items: vendas
      }
    });

  } catch (error) {
    console.error(`❌ Erro ao verificar status:`, error.message);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
