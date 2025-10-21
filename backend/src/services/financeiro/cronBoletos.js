const cron = require('node-cron');
const pool = require('../../config/database');
const axios = require('axios');
const https = require('https');
const { normalizarContaCorrente } = require('./cnaeIbge');

class CronBoletos {
  constructor() {
    this.isRunning = false;
    this.lastRun = null;
    this.stats = {
      totalProcessados: 0,
      sucessos: 0,
      erros: 0,
      ultimaExecucao: null
    };
  }

  // 🔑 Obter token do Inter
  async getInterToken() {
    try {
      const automacao = require('./automacaoRecorrencia');
      return await automacao.obterTokenInter();
    } catch (error) {
      console.log("⚠️ Erro ao obter token via AutomacaoRecorrencia, tentando buscar do banco...");
      
      try {
        const [[row]] = await pool.query(
          'SELECT access_token FROM inter_tokens ORDER BY created_at DESC LIMIT 1'
        );
        if (!row || !row.access_token) {
          throw new Error('Token do Inter não encontrado.');
        }
        return row.access_token;
      } catch (dbError) {
        console.error("❌ Erro ao buscar token do banco:", dbError.message);
        throw new Error('Token do Inter não encontrado.');
      }
    }
  }

  // 🔑 Obter token do Inter com credenciais específicas
  async getInterTokenComCredenciais(contaInter) {
    try {
      // Verificar se já tem token válido no cache
      const [[tokenCache]] = await pool.query(`
        SELECT access_token, created_at, expires_in
        FROM inter_tokens_validate_cache 
        WHERE inter_account_id = ? 
        AND created_at > DATE_SUB(NOW(), INTERVAL 1 HOUR)
        ORDER BY created_at DESC 
        LIMIT 1
      `, [contaInter.id]);

      if (tokenCache?.access_token) {
        console.log(`✅ Token encontrado no cache para conta ${contaInter.apelido}`);
        return tokenCache.access_token;
      }

      // Gerar novo token
      console.log(`🔄 Gerando novo token para conta ${contaInter.apelido}...`);
      
      const scope = "boleto-cobranca.read boleto-cobranca.write";
      const params = new URLSearchParams();
      params.append("client_id", contaInter.client_id);
      params.append("client_secret", contaInter.client_secret);
      params.append("scope", scope);
      params.append("grant_type", "client_credentials");

      const agent = await this.getHttpsAgent(contaInter.id);
      
      // URL base baseada no ambiente
      const baseUrl = contaInter.ambiente === 'hml' 
        ? 'https://cdp.partners.bancointer.com.br' 
        : 'https://cdpj.partners.bancointer.com.br';

      const response = await axios.post(
        `${baseUrl}/oauth/v2/token`,
        params,
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded"
          },
          httpsAgent: agent
        }
      );

      const { access_token, token_type, scope: tokenScope, expires_in } = response.data;

      // Salvar token no cache
      await pool.query(`
        INSERT INTO inter_tokens_validate_cache 
        (inter_account_id, access_token, token_type, scope, expires_in)
        VALUES (?, ?, ?, ?, ?)
      `, [contaInter.id, access_token, token_type || 'Bearer', tokenScope, expires_in]);

      console.log(`✅ Novo token gerado para conta ${contaInter.apelido}`);
      return access_token;

    } catch (error) {
      console.error(`❌ Erro ao gerar token para conta ${contaInter.apelido}:`, error.message);
      throw error;
    }
  }

  // 🔧 Configurar agente HTTPS com credenciais da conta
  async getHttpsAgent(interAccountId = null) {
    try {
      let cert, key;
      
      if (interAccountId) {
        // Buscar credenciais da conta específica
        const [[conta]] = await pool.query(`
          SELECT cert_b64, key_b64 
          FROM inter_accounts 
          WHERE id = ?
        `, [interAccountId]);
        
        if (!conta || !conta.cert_b64 || !conta.key_b64) {
          throw new Error(`Credenciais não encontradas para conta ${interAccountId}`);
        }
        
        cert = Buffer.from(conta.cert_b64, 'base64').toString('utf-8');
        key = Buffer.from(conta.key_b64, 'base64').toString('utf-8');
      } else {
        // Fallback para variáveis de ambiente
        cert = Buffer.from(process.env.INTER_CERT_B64, 'base64').toString('utf-8');
        key = Buffer.from(process.env.INTER_KEY_B64, 'base64').toString('utf-8');
      }
      
      return new https.Agent({ cert, key });
    } catch (error) {
      console.error("❌ Erro ao configurar agente HTTPS:", error.message);
      throw error;
    }
  }

  // 📊 Extrair campos do boleto da API do Inter
  extrairCamposBoleto(api) {
    const cobranca = api.cobranca || api;
    
    const sBruto = (cobranca.situacao || cobranca.status || api.situacao || api.status || '').toString().toUpperCase();
    
    let sConsolidado = 'EM_ABERTO';
    if (['PAGO', 'RECEBIDO', 'LIQUIDADO'].includes(sBruto)) sConsolidado = 'PAGO';
    if (['CANCELADO', 'BAIXADO', 'EXPIRADO'].includes(sBruto)) sConsolidado = 'CANCELADO';

    const valorRecebido = cobranca.valorTotalRecebido || cobranca.valorRecebido || cobranca.valorPago || api.valorRecebido || api.valorPago || null;
    const dataPagamento = cobranca.dataSituacao || cobranca.dataLiquidacao || cobranca.dataPagamento || cobranca.dataCredito || api.dataPagamento || api.dataCredito || null;
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

  // 💰 Verificar se o status indica que o boleto foi pago
  isStatusPago(status) {
    if (!status) return false;
    const statusUpper = status.toString().toUpperCase();
    return ['PAGO', 'RECEBIDO', 'LIQUIDADO'].includes(statusUpper);
  }

  // 💰 Criar transação de contas a receber quando boleto for pago
  async criarTransacaoContasReceber(boletoId, campos) {
    try {
      console.log(`💳 Criando transação de contas a receber para boleto ${boletoId}...`);

      // 1) Buscar informações completas do boleto
      const [[boleto]] = await pool.query(`
        SELECT b.*
        FROM boletos b
        WHERE b.id = ?
      `, [boletoId]);

      if (!boleto) {
        throw new Error(`Boleto ${boletoId} não encontrado`);
      }

      // 2) Verificar se já existe transação para este boleto (usando boleto_id)
      const [transacoesExistentes] = await pool.query(`
        SELECT id, descricao, valor, created_at FROM transacoes 
        WHERE boleto_id = ?
      `, [boletoId]);

      console.log(`🔍 Verificando transações existentes para boleto ${boletoId}: ${transacoesExistentes.length} encontradas`);
      
      // Se já existe transação, não criar nova
      if (transacoesExistentes && transacoesExistentes.length > 0) {
        console.log(`⚠️ Transação já existe para boleto ${boletoId}:`, transacoesExistentes);
        return transacoesExistentes[0].id; // Retorna o ID da transação existente
      }

      // 3) Buscar cliente_id baseado no pagador_cpf_cnpj (se existir)
      let clienteId = null;
      if (boleto.pagador_cpf_cnpj) {
        try {
          const [[cliente]] = await pool.query(`
            SELECT id FROM clientes WHERE documento = ?
          `, [boleto.pagador_cpf_cnpj]);
          clienteId = cliente?.id || null;
        } catch (error) {
          console.log(`⚠️ Cliente não encontrado para CPF/CNPJ: ${boleto.pagador_cpf_cnpj}`);
        }
      }

      // 4) Criar a transação com dados essenciais do boleto
      const valorRecebido = campos.valorRecebido || boleto.valor_nominal;
      const dataPagamento = campos.dataPagamento || new Date();
      const dataVencimento = boleto.data_vencimento || boleto.vencimento;

      const [resultado] = await pool.query(`
        INSERT INTO transacoes (
          company_id, cliente_id, tipo, descricao, valor, 
          data_transacao, data_vencimento, situacao, observacoes, 
          boleto_id, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
      `, [
        boleto.company_id || 1,
        clienteId,
        'entrada',
        `Recebimento - Boleto ${boleto.seu_numero || boleto.codigo_solicitacao}`,
        valorRecebido,
        dataPagamento,
        dataVencimento,
        'recebido',
        `Boleto pago via Inter. Código: ${boleto.codigo_solicitacao}. Pagador: ${boleto.pagador_nome || 'N/A'}`,
        boletoId
      ]);

      console.log(`✅ Transação de contas a receber criada com sucesso! ID: ${resultado.insertId}`);

      // 5) Atualizar o boleto com o ID da transação criada
      await pool.query(`
        UPDATE boletos 
        SET pago_recebido_id = ? 
        WHERE id = ?
      `, [resultado.insertId, boletoId]);

      console.log(`✅ Boleto ${boletoId} atualizado com pago_recebido_id = ${resultado.insertId}`);

      return resultado.insertId;

    } catch (error) {
      console.error(`❌ Erro ao criar transação de contas a receber para boleto ${boletoId}:`, error.message);
      throw error;
    }
  }

  // 🛒 Criar venda automaticamente quando boleto for pago
  async criarVendaAutomatica(boleto, campos, clienteId, origemCron = true) {
    try {
      console.log(`🛒 Criando venda automática para boleto ${boleto.id}...`);

      // 1) Verificar se já existe venda para este boleto (usando boleto_id)
      const [vendasExistentes] = await pool.query(`
        SELECT id FROM vendas 
        WHERE boleto_id = ?
      `, [boleto.id]);

      console.log(`🔍 Verificando vendas existentes para boleto ${boleto.id}: ${vendasExistentes.length} encontradas`);

      // Se já existe venda, não criar nova
      if (vendasExistentes && vendasExistentes.length > 0) {
        console.log(`⚠️ Venda já existe para boleto ${boleto.id}`);
        return vendasExistentes[0].id;
      }

      // 2) Buscar cliente_id se não foi passado
      if (!clienteId) {
        if (boleto.pagador_cpf_cnpj) {
          try {
            const [[cliente]] = await pool.query(`
              SELECT id FROM clientes WHERE documento = ?
            `, [boleto.pagador_cpf_cnpj]);
            clienteId = cliente?.id || null;
          } catch (error) {
            console.log(`⚠️ Cliente não encontrado para CPF/CNPJ: ${boleto.pagador_cpf_cnpj}`);
          }
        }

        // Se não encontrou cliente, buscar um cliente padrão
        if (!clienteId) {
          try {
            // Buscar primeiro cliente disponível
            const [[clientePadrao]] = await pool.query(`
              SELECT id FROM clientes WHERE company_id = ? LIMIT 1
            `, [boleto.company_id || 1]);
            clienteId = clientePadrao?.id || 1; // Fallback para ID 1
            console.log(`⚠️ Usando cliente padrão ID: ${clienteId}`);
          } catch (error) {
            console.log(`⚠️ Erro ao buscar cliente padrão, usando ID 1`);
            clienteId = 1; // Cliente padrão
          }
        }
      }

      // 3) Buscar conta de recebimento padrão (conta_api)
      let contaRecebimentoApi = null;
      if (boleto.inter_account_id) {
        try {
          const [[contaApi]] = await pool.query(`
            SELECT id FROM contas_api 
            WHERE inter_account_id = ?
          `, [boleto.inter_account_id]);
          contaRecebimentoApi = contaApi?.id || null;
        } catch (error) {
          console.log(`⚠️ Conta API não encontrada para inter_account_id: ${boleto.inter_account_id}`);
        }
      }

      // 4) Buscar categoria e sub_categoria do contrato (se o boleto estiver relacionado a um contrato)
      let categoriaId = null;
      let subCategoriaId = null;
      
      if (boleto.contrato_id) {
        try {
          console.log(`📋 Buscando categorias do contrato ${boleto.contrato_id}...`);
          const [[contrato]] = await pool.query(`
            SELECT categoria_id, sub_categoria_id 
            FROM contratos 
            WHERE id = ?
          `, [boleto.contrato_id]);
          
          if (contrato) {
            categoriaId = contrato.categoria_id;
            subCategoriaId = contrato.sub_categoria_id;
            console.log(`✅ Categorias encontradas no contrato: categoria_id=${categoriaId}, sub_categoria_id=${subCategoriaId}`);
          } else {
            console.log(`⚠️ Contrato ${boleto.contrato_id} não encontrado`);
          }
        } catch (error) {
          console.log(`⚠️ Erro ao buscar categorias do contrato: ${error.message}`);
        }
      }

      // 5) Se não encontrou categorias no contrato, buscar categoria padrão para vendas
      if (!categoriaId) {
        try {
          const [[categoria]] = await pool.query(`
            SELECT c.id 
            FROM categorias c
            INNER JOIN tipos t ON c.tipo_id = t.id
            WHERE t.company_id = ? AND (c.nome LIKE '%venda%' OR c.nome LIKE '%receita%')
            LIMIT 1
          `, [boleto.company_id || 1]);
          categoriaId = categoria?.id || null;
          console.log(`📋 Usando categoria padrão: ${categoriaId}`);
        } catch (error) {
          console.log(`⚠️ Categoria padrão não encontrada`);
        }
      }

      // 6) Criar a venda com dados do boleto
      const valorVenda = campos.valorRecebido || boleto.valor_nominal;
      const dataVenda = campos.dataPagamento || new Date();
      const dataVencimento = boleto.data_vencimento || boleto.vencimento;

      console.log(`📊 Dados para criar venda: clienteId=${clienteId}, categoriaId=${categoriaId}, subCategoriaId=${subCategoriaId}, valorVenda=${valorVenda}`);

      const [resultado] = await pool.query(`
        INSERT INTO vendas (
          tipo_venda, cliente_id, categoria_id, sub_categoria_id, company_id, 
          data_venda, situacao, valor_venda, 
          conta_recebimento_api, vencimento, observacoes,
          boleto_id, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
      `, [
        'orcamento', // tipo_venda válido
        clienteId,
        categoriaId,
        subCategoriaId,
        boleto.company_id || 1,
        dataVenda,
        'aprovado', // situacao válida (quando boleto é pago, venda é aprovada)
        valorVenda,
        contaRecebimentoApi,
        dataVencimento,
        `Venda automática - Boleto ${boleto.seu_numero || boleto.codigo_solicitacao}. Pagador: ${boleto.pagador_nome || 'N/A'}`,
        boleto.id
      ]);

      console.log(`✅ Venda automática criada com sucesso! ID: ${resultado.insertId}`);

      // 7) Atualizar o boleto com o ID da venda criada
      await pool.query(`
        UPDATE boletos 
        SET venda_id = ? 
        WHERE id = ?
      `, [resultado.insertId, boleto.id]);

      console.log(`✅ Boleto ${boleto.id} atualizado com venda_id = ${resultado.insertId}`);

      // 🚫 NÃO criar boleto quando a venda vem do cron (boleto já existe)
      if (!origemCron) {
        console.log(`📄 Criando boleto para venda ${resultado.insertId} (criação manual)...`);
        // Aqui você pode adicionar a lógica para criar boleto se necessário
        // await this.criarBoletoParaVenda(resultado.insertId);
      } else {
        console.log(`✅ Venda criada a partir de boleto existente (cron) - não criando novo boleto`);
      }

      return resultado.insertId;

    } catch (error) {
      console.error(`❌ Erro ao criar venda automática para boleto ${boleto.id}:`, error.message);
      console.error(`❌ Stack trace:`, error.stack);
      // Não vamos falhar a transação se a venda der erro, mas vamos logar o erro completo
      console.log(`⚠️ Continuando sem criar venda automática...`);
      throw error; // Re-throw para que o erro seja visível
    }
  }

  // 🛒 Criar venda automaticamente (função separada para ser chamada independentemente)
  async criarVendaParaBoleto(boletoId, parametros = {}, origemCron = false) {
    try {
      console.log(`🛒 Criando venda para boleto ${boletoId}...`);

      // 1) Buscar informações completas do boleto
      const [[boleto]] = await pool.query(`
        SELECT b.*
        FROM boletos b
        WHERE b.id = ?
      `, [boletoId]);

      if (!boleto) {
        throw new Error(`Boleto ${boletoId} não encontrado`);
      }

      // 2) Verificar se já existe venda para este boleto (usando boleto_id)
      const [vendasExistentes] = await pool.query(`
        SELECT id FROM vendas 
        WHERE boleto_id = ?
      `, [boletoId]);

      console.log(`🔍 Verificando vendas existentes para boleto ${boletoId}: ${vendasExistentes.length} encontradas`);

      // Se já existe venda, não criar nova
      if (vendasExistentes && vendasExistentes.length > 0) {
        console.log(`⚠️ Venda já existe para boleto ${boletoId}`);
        return vendasExistentes[0].id;
      }

      // 3) Buscar cliente_id baseado no pagador_cpf_cnpj (se existir)
      let clienteId = null;
      if (boleto.pagador_cpf_cnpj) {
        try {
          const [[cliente]] = await pool.query(`
            SELECT id FROM clientes WHERE documento = ?
          `, [boleto.pagador_cpf_cnpj]);
          clienteId = cliente?.id || null;
        } catch (error) {
          console.log(`⚠️ Cliente não encontrado para CPF/CNPJ: ${boleto.pagador_cpf_cnpj}`);
        }
      }

      // Se não encontrou cliente, buscar um cliente padrão
      if (!clienteId) {
        try {
          // Buscar primeiro cliente disponível
          const [[clientePadrao]] = await pool.query(`
            SELECT id FROM clientes WHERE company_id = ? LIMIT 1
          `, [boleto.company_id || 1]);
          clienteId = clientePadrao?.id || 1; // Fallback para ID 1
          console.log(`⚠️ Usando cliente padrão ID: ${clienteId}`);
        } catch (error) {
          console.log(`⚠️ Erro ao buscar cliente padrão, usando ID 1`);
          clienteId = 1; // Cliente padrão
        }
      }

      // 4) Buscar conta de recebimento padrão (conta_api)
      let contaRecebimentoApi = null;
      if (boleto.inter_account_id) {
        try {
          const [[contaApi]] = await pool.query(`
            SELECT id FROM contas_api 
            WHERE inter_account_id = ?
          `, [boleto.inter_account_id]);
          contaRecebimentoApi = contaApi?.id || null;
        } catch (error) {
          console.log(`⚠️ Conta API não encontrada para inter_account_id: ${boleto.inter_account_id}`);
        }
      }

      // 5) Buscar categoria e sub_categoria (priorizar parâmetros enviados, depois contrato, depois padrão)
      let categoriaId = parametros.categoria_id || null;
      let subCategoriaId = parametros.sub_categoria_id || null;
      
      // Se não foram enviados parâmetros, buscar do contrato
      if (!categoriaId && boleto.contrato_id) {
        try {
          console.log(`📋 Buscando categorias do contrato ${boleto.contrato_id}...`);
          const [[contrato]] = await pool.query(`
            SELECT categoria_id, sub_categoria_id 
            FROM contratos 
            WHERE id = ?
          `, [boleto.contrato_id]);
          
          if (contrato) {
            categoriaId = contrato.categoria_id;
            subCategoriaId = contrato.sub_categoria_id;
            console.log(`✅ Categorias encontradas no contrato: categoria_id=${categoriaId}, sub_categoria_id=${subCategoriaId}`);
          } else {
            console.log(`⚠️ Contrato ${boleto.contrato_id} não encontrado`);
          }
        } catch (error) {
          console.log(`⚠️ Erro ao buscar categorias do contrato: ${error.message}`);
        }
      }
      
      // Se ainda não tem categoria, buscar categoria padrão
      if (!categoriaId) {
        try {
          const [[categoria]] = await pool.query(`
            SELECT c.id 
            FROM categorias c
            INNER JOIN tipos t ON c.tipo_id = t.id
            WHERE t.company_id = ? AND (c.nome LIKE '%venda%' OR c.nome LIKE '%receita%')
            LIMIT 1
          `, [boleto.company_id || 1]);
          categoriaId = categoria?.id || null;
          console.log(`📋 Usando categoria padrão: ${categoriaId}`);
        } catch (error) {
          console.log(`⚠️ Categoria padrão não encontrada`);
        }
      } else {
        console.log(`📋 Usando categoria: ${categoriaId} (${parametros.categoria_id ? 'enviada' : 'do contrato'})`);
      }
      
      if (subCategoriaId) {
        console.log(`📋 Usando sub_categoria: ${subCategoriaId} (${parametros.sub_categoria_id ? 'enviada' : 'do contrato'})`);
      }

      // 7) Criar a venda com dados do boleto
      const valorVenda = boleto.valor_recebido || boleto.valor_nominal;
      const dataVenda = boleto.data_pagamento || new Date();
      const dataVencimento = boleto.data_vencimento || boleto.vencimento;

             const [resultado] = await pool.query(`
         INSERT INTO vendas (
           tipo_venda, cliente_id, categoria_id, sub_categoria_id, company_id, 
           data_venda, situacao, valor_venda, 
           conta_recebimento_api, vencimento, observacoes,
           boleto_id, created_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
       `, [
         'orcamento', // tipo_venda válido (mudando para 'orcamento' para testar)
         clienteId,
         categoriaId,
         subCategoriaId,
         boleto.company_id || 1,
         dataVenda,
         'aprovado', // situacao válida (quando boleto é pago, venda é aprovada)
         valorVenda,
         contaRecebimentoApi,
         dataVencimento,
         `Venda automática - Boleto ${boleto.seu_numero || boleto.codigo_solicitacao}. Pagador: ${boleto.pagador_nome || 'N/A'}`,
         boletoId
       ]);

      console.log(`✅ Venda criada com sucesso! ID: ${resultado.insertId}`);

      // 7) Atualizar o boleto com o ID da venda criada
      await pool.query(`
        UPDATE boletos 
        SET venda_id = ? 
        WHERE id = ?
      `, [resultado.insertId, boletoId]);

             console.log(`✅ Boleto ${boletoId} atualizado com venda_id = ${resultado.insertId}`);

       // 🚫 NÃO criar boleto quando a venda vem do cron (boleto já existe)
       if (!origemCron) {
         console.log(`📄 Criando boleto para venda ${resultado.insertId} (criação manual)...`);
         // Aqui você pode adicionar a lógica para criar boleto se necessário
         // await this.criarBoletoParaVenda(resultado.insertId);
       } else {
         console.log(`✅ Venda criada a partir de boleto existente (cron) - não criando novo boleto`);
       }

       return resultado.insertId;

    } catch (error) {
      console.error(`❌ Erro ao criar venda para boleto ${boletoId}:`, error.message);
      throw error;
    }
  }

  // 💪 Criar transação de contas a receber FORÇADA (ignora verificação de duplicata)
  async criarTransacaoContasReceberForcado(boletoId, campos) {
    try {
      console.log(`💪 Forçando criação de transação de contas a receber para boleto ${boletoId}...`);

      // 1) Buscar informações completas do boleto
      const [[boleto]] = await pool.query(`
        SELECT b.*
        FROM boletos b
        WHERE b.id = ?
      `, [boletoId]);

      if (!boleto) {
        throw new Error(`Boleto ${boletoId} não encontrado`);
      }

      // 2) REMOVER transação existente se houver (força nova criação)
      const [[transacaoExistente]] = await pool.query(`
        SELECT id FROM transacoes 
        WHERE boleto_id = ?
      `, [boletoId]);

      if (transacaoExistente) {
        console.log(`🗑️ Removendo transação existente para boleto ${boletoId}...`);
        await pool.query(`DELETE FROM transacoes WHERE boleto_id = ?`, [boletoId]);
        
        // Limpar pago_recebido_id do boleto
        await pool.query(`UPDATE boletos SET pago_recebido_id = NULL WHERE id = ?`, [boletoId]);
      }

      // 3) Buscar cliente_id baseado no pagador_cpf_cnpj (se existir)
      let clienteId = null;
      if (boleto.pagador_cpf_cnpj) {
        try {
          const [[cliente]] = await pool.query(`
            SELECT id FROM clientes WHERE documento = ?
          `, [boleto.pagador_cpf_cnpj]);
          clienteId = cliente?.id || null;
        } catch (error) {
          console.log(`⚠️ Cliente não encontrado para CPF/CNPJ: ${boleto.pagador_cpf_cnpj}`);
        }
      }

             // 4) Criar a transação com dados essenciais do boleto
       const valorRecebido = campos.valorRecebido || boleto.valor_nominal;
       const dataPagamento = campos.dataPagamento || new Date();
       const dataVencimento = boleto.data_vencimento || boleto.vencimento;

       const [resultado] = await pool.query(`
         INSERT INTO transacoes (
           company_id, cliente_id, tipo, descricao, valor, 
           data_transacao, data_vencimento, situacao, observacoes, 
           boleto_id, created_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
       `, [
         boleto.company_id || 1,
         clienteId,
         'entrada',
         `Recebimento - Boleto ${boleto.seu_numero || boleto.codigo_solicitacao}`,
         valorRecebido,
         dataPagamento,
         dataVencimento,
         'recebido',
         `Boleto pago via Inter. Código: ${boleto.codigo_solicitacao}. Pagador: ${boleto.pagador_nome || 'N/A'}`,
         boletoId
       ]);

              console.log(`✅ Transação de contas a receber criada com sucesso (forçada)! ID: ${resultado.insertId}`);

       // 5) Atualizar o boleto com o ID da transação criada
       await pool.query(`
         UPDATE boletos 
         SET pago_recebido_id = ? 
         WHERE id = ?
       `, [resultado.insertId, boletoId]);

       console.log(`✅ Boleto ${boletoId} atualizado com pago_recebido_id = ${resultado.insertId}`);

       return resultado.insertId;

    } catch (error) {
      console.error(`❌ Erro ao forçar criação de transação de contas a receber para boleto ${boletoId}:`, error.message);
      throw error;
    }
  }

  // 🔄 Sincronizar um boleto específico
  async sincronizarBoleto(codigoSolicitacao) {
    try {
      // 1) Verificar se o boleto existe localmente e obter inter_account_id
      const [[boleto]] = await pool.query(
        'SELECT id, status, inter_account_id FROM boletos WHERE codigo_solicitacao = ? LIMIT 1',
        [codigoSolicitacao]
      );
      
      if (!boleto) {
        throw new Error('Boleto não localizado no banco');
      }

      if (!boleto.inter_account_id) {
        throw new Error('Boleto não tem inter_account_id configurado');
      }

      // 2) Buscar informações da conta Inter
      const [[contaInter]] = await pool.query(`
        SELECT id, apelido, conta_corrente, client_id, client_secret, ambiente
        FROM inter_accounts 
        WHERE id = ?
      `, [boleto.inter_account_id]);

      if (!contaInter) {
        throw new Error(`Conta Inter ${boleto.inter_account_id} não encontrada`);
      }

      // 3) Obter token usando as credenciais da conta específica
      console.log(`🔑 Obtendo token do Inter para ${codigoSolicitacao} usando conta ${contaInter.apelido}...`);
      let access_token = await this.getInterTokenComCredenciais(contaInter);
      console.log(`✅ Token obtido: ${access_token.substring(0, 20)}...`);
      
      const agent = await this.getHttpsAgent(boleto.inter_account_id);
      const contaCorrente = normalizarContaCorrente(contaInter.conta_corrente);
      console.log(`🏦 Conta corrente: ${contaCorrente}`);

      // 4) Consultar API do Inter
      let data;
      try {
        // URL base baseada no ambiente
        const baseUrl = contaInter.ambiente === 'hml' 
          ? 'https://cdp.partners.bancointer.com.br' 
          : 'https://cdpj.partners.bancointer.com.br';

        const response = await axios.get(
          `${baseUrl}/cobranca/v3/cobrancas/${codigoSolicitacao}`,
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
        // Se der erro 401, regenerar token e tentar novamente
        if (error.response?.status === 401) {
          console.log(`🔄 Token expirado para ${codigoSolicitacao}, regenerando...`);
          
          access_token = await this.getInterTokenComCredenciais(contaInter);
          
          const baseUrl = contaInter.ambiente === 'hml' 
            ? 'https://cdp.partners.bancointer.com.br' 
            : 'https://cdpj.partners.bancointer.com.br';
          
          const retryResponse = await axios.get(
            `${baseUrl}/cobranca/v3/cobrancas/${codigoSolicitacao}`,
            {
              headers: {
                Authorization: `Bearer ${access_token}`,
                'x-conta-corrente': contaCorrente
              },
              httpsAgent: agent
            }
          );
          data = retryResponse.data;
        } else {
          throw error;
        }
      }

      // 5) Extrair e processar campos
      const campos = this.extrairCamposBoleto(data);
      console.log(`📊 Campos extraídos para ${codigoSolicitacao}:`, campos);

      // 6) Atualizar banco local
      console.log(`💾 Atualizando boleto ${codigoSolicitacao} no banco...`);
      const [updateResult] = await pool.query(
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
      
      console.log(`✅ Boleto ${codigoSolicitacao} atualizado. Linhas afetadas: ${updateResult.affectedRows}`);

      // 7) Gravar histórico se houve mudança
      const statusAnterior = (boleto.status || null);
      const statusAtual = (campos.statusBruto || null);

      console.log(`🔍 Status do boleto ${codigoSolicitacao}: Anterior=${statusAnterior}, Atual=${statusAtual}`);
      console.log(`🔍 Verificando se mudou: ${statusAnterior !== statusAtual}`);
      console.log(`🔍 Verificando se foi pago: isStatusPago(atual)=${this.isStatusPago(statusAtual)}, isStatusPago(anterior)=${this.isStatusPago(statusAnterior)}`);

      // 8) Se o boleto foi pago, APENAS atualizar venda se existir (NÃO CRIAR NADA!)
      if (this.isStatusPago(statusAtual)) {
        console.log(`💰 Boleto ${codigoSolicitacao} está pago! Verificando venda_id...`);
        
        // BUSCAR venda_id direto do boleto
        const [[boletoComVenda]] = await pool.query(`
          SELECT id, venda_id FROM boletos WHERE id = ?
        `, [boleto.id]);
        
        if (boletoComVenda && boletoComVenda.venda_id) {
          console.log(`✅ Boleto ${boleto.id} tem venda_id: ${boletoComVenda.venda_id}`);
          
          // ATUALIZAR DIRETO a venda para "pago"
          console.log(`🔄 Atualizando venda ${boletoComVenda.venda_id} para "pago"...`);
          const [resultado] = await pool.query(`
            UPDATE vendas 
            SET situacao = 'pago',
                updated_at = NOW()
            WHERE id = ?
          `, [boletoComVenda.venda_id]);
          
          if (resultado.affectedRows > 0) {
            console.log(`✅ Venda ${boletoComVenda.venda_id} → "pago"`);
          }
        } else {
          console.log(`⚠️ Boleto ${boleto.id} NÃO tem venda_id - pulando`);
        }
      } else {
        console.log(`⚠️ Boleto ${codigoSolicitacao} não está pago (status: ${statusAtual})`);
      }

      // 9) Gravar histórico se houve mudança de status
      if (statusAnterior !== statusAtual) {
        console.log(`📝 Status mudou para ${codigoSolicitacao}! Gravando histórico...`);
        await pool.query(
          `INSERT INTO boleto_status_historico
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
      } else {
        console.log(`📝 Boleto ${codigoSolicitacao} não mudou status (${statusAnterior} = ${statusAtual})`);
      }

      return {
        success: true,
        codigoSolicitacao,
        situacao: campos.statusConsolidado,
        statusBruto: campos.statusBruto,
        mudouStatus: statusAnterior !== statusAtual
      };

    } catch (error) {
      console.error(`❌ Erro ao sincronizar boleto ${codigoSolicitacao}:`, error.message);
      return {
        success: false,
        codigoSolicitacao,
        error: error.message
      };
    }
  }

  // 🚀 Executar sincronização de todos os boletos abertos
  async executarSincronizacao() {
    if (this.isRunning) {
      console.log("⚠️ Sincronização já está em execução, pulando...");
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();
    
    console.log("🔄 Iniciando sincronização automática de boletos...");
    console.log("🔍 Verificando se há boletos para sincronizar...");

        try {
             // Buscar TODOS os boletos para sincronizar (independente do status)
       // IMPORTANTE: Usar DISTINCT para evitar duplicatas do mesmo codigo_solicitacao
       const [boletos] = await pool.query(`
         SELECT DISTINCT b.codigo_solicitacao, b.status, b.created_at, b.inter_account_id
           FROM boletos b
          WHERE b.codigo_solicitacao IS NOT NULL
            AND b.inter_account_id IS NOT NULL
          ORDER BY b.created_at DESC
        `);

      console.log(`📋 Encontrados ${boletos.length} boletos para sincronizar`);
      
      if (boletos.length > 0) {
        console.log("📝 Boletos encontrados:");
        boletos.forEach((boleto, index) => {
          console.log(`  ${index + 1}. ${boleto.codigo_solicitacao} (Status: ${boleto.status || 'NULL'})`);
        });
      }

      if (boletos.length === 0) {
        console.log("✅ Nenhum boleto pendente para sincronização");
        return;
      }

      // Processar boletos em lotes para não sobrecarregar
      const batchSize = 5;
      const resultados = [];
      let sucessos = 0;
      let erros = 0;

      for (let i = 0; i < boletos.length; i += batchSize) {
        const batch = boletos.slice(i, i + batchSize);
        
        console.log(`📦 Processando lote ${Math.floor(i/batchSize) + 1}/${Math.ceil(boletos.length/batchSize)} (${batch.length} boletos)`);
        
        // Processar lote em paralelo
        const batchPromises = batch.map(boleto => 
          this.sincronizarBoleto(boleto.codigo_solicitacao)
        );
        
        const batchResults = await Promise.allSettled(batchPromises);
        
        batchResults.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            resultados.push(result.value);
            if (result.value.success) {
              sucessos++;
              if (result.value.mudouStatus) {
                console.log(`✅ ${result.value.codigoSolicitacao}: ${result.value.situacao}`);
              }
            } else {
              erros++;
              console.log(`❌ ${result.value.codigoSolicitacao}: ${result.value.error}`);
            }
          } else {
            erros++;
            console.log(`❌ Erro no processamento: ${result.reason}`);
          }
        });

        // Aguardar entre lotes para não sobrecarregar a API
        if (i + batchSize < boletos.length) {
          console.log("⏳ Aguardando 2 segundos antes do próximo lote...");
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }

      // Atualizar estatísticas
      this.stats = {
        totalProcessados: boletos.length,
        sucessos,
        erros,
        ultimaExecucao: new Date().toISOString()
      };

      const duration = Date.now() - startTime;
      console.log(`✅ Sincronização concluída em ${duration}ms`);
      console.log(`📊 Resultados: ${sucessos} sucessos, ${erros} erros`);

    } catch (error) {
      console.error("❌ Erro na sincronização automática:", error);
    } finally {
      this.isRunning = false;
      this.lastRun = new Date().toISOString();
    }
  }

  // 🕐 Iniciar cron jobs
  iniciarCronJobs() {
    console.log("🤖 Iniciando cron jobs para sincronização de boletos...");

    // Executar às 10:06 da manhã todos os dias
    cron.schedule('06 10 * * *', () => {
      console.log("⏰ Executando sincronização automática de boletos (10:06 da manhã)");
      this.executarSincronizacao();
    }, {
      scheduled: true,
      timezone: "America/Sao_Paulo"
    });

    // Executar imediatamente para teste
    console.log("🚀 Executando sincronização inicial para teste...");
    setTimeout(() => {
      this.executarSincronizacao();
    }, 5000); // Executar após 5 segundos

    console.log("✅ Cron jobs iniciados com sucesso!");
  }

  // 📊 Obter estatísticas
  getStats() {
    return {
      ...this.stats,
      isRunning: this.isRunning,
      lastRun: this.lastRun
    };
  }

  // 🛑 Parar cron jobs
  pararCronJobs() {
    console.log("🛑 Parando cron jobs de sincronização de boletos...");
    cron.getTasks().forEach(task => task.stop());
  }

}

module.exports = new CronBoletos(); 